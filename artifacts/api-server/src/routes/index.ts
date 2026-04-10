import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dealsRouter from "./deals";
import paymentsRouter from "./payments";
import expensesRouter from "./expenses";
import dashboardRouter from "./dashboard";
import assistRouter from "./assist";
import complianceRouter from "./compliance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dealsRouter);
router.use(paymentsRouter);
router.use(expensesRouter);
router.use(dashboardRouter);
router.use(assistRouter);
router.use(complianceRouter);

export default router;
