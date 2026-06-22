import { Router, type IRouter } from "express";
import healthRouter from "./health";
import privacyRouter from "./privacy";
import aiRouter from "./ai/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(privacyRouter);
router.use(aiRouter);

export default router;
