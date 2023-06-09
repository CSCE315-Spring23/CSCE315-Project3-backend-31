import express from "express";
import { Database } from "../server.js";
const restaurantRouter = express.Router();

/**
 * Gets all restaurants
 */
restaurantRouter.get("/", async (req, res) => {
	try {
		res.send(await Database.getRestaurant());
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

/**
 * Gets restock report
 */
restaurantRouter.get("/restockreport", async (req, res) => {
	const minimumQty = req.query.minimumQty;
	try {
		res.send(await Database.getRestockReport(minimumQty));
		console.log("Restock Report generated successfully");
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

/**
 * Gets excess report
 */
restaurantRouter.get("/excessreport", async (req, res) => {
	const timestamp = req.query.timestamp;
	try {
		res.send(await Database.getExcessReport(timestamp));
		console.log("Excess Report generated successfully");
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

/**
 * Gets sales report
 */
restaurantRouter.get("/salesreport", async (req, res) => {
	const sDate = req.query.sDate;
	const eDate = req.query.eDate;
	try {
		res.send(await Database.getSalesReport(sDate, eDate));
		console.log("Sales Report generated successfully");
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

/**
 * Gets x report
 */
restaurantRouter.get("/xreport", async (req, res) => {
	try {
		res.send(await Database.getXReport(1));
		console.log("X Report generated successfully");
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

/**
 * Gets z report
 */
restaurantRouter.get("/zreport", async (req, res) => {
	try {
		res.send(await Database.getZReport(1));
		console.log("Z Report generated successfully");
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});
export default restaurantRouter;
