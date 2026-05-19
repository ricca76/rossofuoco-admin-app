import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

router.get("/kds/download", (req, res) => {
  const zipPath = path.join(process.cwd(), "public", "rosso-kds.zip");
  if (!fs.existsSync(zipPath)) {
    res.status(404).json({ error: "File non trovato" });
    return;
  }
  const stat = fs.statSync(zipPath);
  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="Rosso KDS.zip"',
    "Content-Length": String(stat.size),
    "Cache-Control": "public, max-age=3600",
  });
  fs.createReadStream(zipPath).pipe(res);
});

export default router;
