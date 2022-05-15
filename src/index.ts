import server from "fastify";
import { fabric } from "fabric";
import fs, { existsSync, mkdirSync } from "fs";
import jsPDF from "jspdf";
import { IStaticCanvasOptions } from "fabric/fabric-impl";
import path from "path";

var faker = require("@faker-js/faker").faker;

interface IFabricObj {
  fabricObj: fabric.IStaticCanvasOptions[];
  name?: string;
  count: number;
}

const fastify = server({ logger: true });

fastify.post<{
  Body: IFabricObj;
}>("/", async (request, reply) => {
  const { fabricObj, name = "", count = 0 }: IFabricObj = request.body;
  const pageCount = fabricObj.length;
  const time = new Date().getTime();
  for (let i = 0; i < count; i++) {
    const doc = new jsPDF();
    fabricObj.forEach((page, index) => {
      const fab: IStaticCanvasOptions = page;
      const { height, width } = fab.backgroundImage as fabric.Image;
      const canvas = new fabric.StaticCanvas(null, {
        width: width,
        height: height,
      });
      canvas.loadFromJSON(
        fab,
        function () {
          canvas.renderAll();

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
          if (index === pageCount - 1) {
            const fileName = `${name?.trim()} - ${i + 1}.pdf`;
            const fileData = doc.output();
            const outputDir = path.join(
              __dirname,
              "..",
              "data",
              time.toString()
            );
            if (!existsSync(outputDir)) {
              mkdirSync(outputDir, { recursive: true });
            }
            const filePath = path.join(outputDir, fileName);
            fs.writeFileSync(filePath, fileData, "binary");
          }
        },
        function (o: any, object: any) {
          // new Promise(function (resolve, reject) {
          const type = (object as fabric.Object).get("type");
          if (type === "i-text") {
            object.set({ text: eval(o["expression"]) });
            // resolve(true);
          }
          // });
        }
        // );
      );
    });
  }
  return { hello: "world" };
});

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
