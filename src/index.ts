import server from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fabric } from "fabric";
import { createReadStream, existsSync, mkdirSync } from "fs";
import jsPDF from "jspdf";
import { IStaticCanvasOptions } from "fabric/fabric-impl";
import path from "path";
import { nanoid } from "nanoid";
import AdmZip from "adm-zip";

var faker = require("@faker-js/faker").faker;

interface IFabricObj {
  fabricObjects: fabric.IStaticCanvasOptions[];
  name?: string;
  count: number;
}

interface IQueryString {
  name: string;
  folder: string;
}

const fastify = server({ logger: true });

fastify.register(fastifyCors, {
  origin: "*",
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
});

fastify.get<{
  Querystring: IQueryString;
}>("/download", async (request, reply) => {
  const { folder, name }: IQueryString = request.query;
  const filePath = path.join(__dirname, "..", "data", folder, name + ".zip");
  if (existsSync(filePath)) {
    const stream = createReadStream(filePath);
    return reply
      .header("Content-Disposition", `attachment;`)
      .header("Content-Type", "application/zip")
      .send(stream);
  } else {
    return reply.status(404).send();
  }
});

fastify.get("/", async (_request, reply) => {
  return reply.sendFile("index.html");
});

fastify.post<{
  Body: IFabricObj;
}>("/", async (request, reply) => {
  try {
    const {
      fabricObjects,
      name = "File",
      count = 1,
    }: IFabricObj = request.body;
    const folder = nanoid();
    const zip = new AdmZip();
    const allPromises: any = [];
    for (let i = 0; i < count; i++) {
      const doc = new jsPDF();
      let index = 0;
      for (let page of fabricObjects) {
        const fab: IStaticCanvasOptions = page;
        const { height, width } = fab.backgroundImage as fabric.Image;
        const canvas = new fabric.StaticCanvas(null, {
          width: width,
          height: height,
        });
        allPromises.push(await loadJSON(canvas, fab, doc, index++));
      }
      Promise.all(allPromises).then(() => {
        const fileName = `${name.trim()} - ${i + 1}.pdf`;
        const fileData = doc.output();
        const outputDir = path.join(__dirname, "..", "data", folder);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
        zip.addFile(fileName, Buffer.from(fileData, "binary"), "", 0o0644);
        const zipPath = path.join(outputDir, name.trim() + ".zip");
        zip.writeZip(zipPath);
      });
    }
    return reply.status(200).send({ folder, name: name.trim() });
  } catch (e) {
    console.error(e);
    return reply.status(400).send();
  }
});

async function loadJSON(
  canvas: fabric.StaticCanvas,
  fab: IStaticCanvasOptions,
  doc: jsPDF,
  index: number
) {
  return new Promise((resolve) => {
    canvas.loadFromJSON(
      fab,
      function () {
        canvas.renderAll();

        if (index != 0) {
          doc.addPage();
          doc.setPage(index + 1);
        }
        doc.addImage(
          canvas.toDataURL({ format: "png" }),
          "PNG",
          0,
          0,
          doc.internal.pageSize.getWidth(),
          doc.internal.pageSize.getHeight(),
          `page-${index + 1}`,
          "FAST"
        );
        resolve(true);
      },
      function (o: any, object: any) {
        const type = (object as fabric.Object).get("type");
        if (type === "i-text" && o["expression"]) {
          object.set({ text: eval(o["expression"]) });
        }
      }
    );
  });
}

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
