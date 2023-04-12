import { pool } from "../server.js";

class Data {
	async getOrder(order_id) {
		const { rows } = await pool.query(
			"SELECT * FROM orders WHERE order_id = $1;",
			[order_id]
		);
		return rows[0];
	}

	async getOrdersByCustomerId(customer_id) {
		const { rows } = await pool.query(
			"SELECT * FROM orders WHERE customer_id = $1;",
			[customer_id]
		);
		return rows;
	}

	async getOrdersByDate(date) {
		const { rows } = await pool.query(
			"SELECT * FROM orders WHERE date = $1;",
			[date]
		);
		return rows;
	}

	async getOrdersSinceDate(date) {
		const { rows } = await pool.query(
			"SELECT * FROM orders WHERE date >= $1;",
			[date]
		);
		return rows;
	}

	async getAllOrders() {
		const { rows } = await pool.query("SELECT * FROM orders;");
		return rows;
	}

	async getRecentOrders() {
		const { rows } = await pool.query(
			"SELECT * FROM orders ORDER BY order_id DESC LIMIT 50;"
		);
		return rows;
	}

	async getMenu(menu_id) {
		const { rows } = await pool.query(
			"SELECT * FROM menu WHERE menu_id = $1;",
			[menu_id]
		);
		return rows[0];
	}

	async getMenuName(menu_id) {
		const { rows } = await pool.query(
			"SELECT * FROM menu WHERE menu_id = $1;",
			[menu_id]
		);
		return rows[0].name;
	}

	async getInventoryItemsByMenuId(menu_id) {
		try {
			const { rows } = await pool.query(
				"SELECT * FROM inventory_to_menu WHERE menu_id = $1;",
				[menu_id]
			);
			return rows;
		} catch (err) {
			console.error(err);
			return null;
		}
	}

	async getMenuByName(name) {
		const { rows } = await pool.query(
			"SELECT * FROM menu WHERE name = $1;",
			[name]
		);
		const inventory_items = await getInventoryItemsByMenuId(
			rows[0].menu_id
		);
		const menu = {
			menu_id: rows[0].menu_id,
			name: rows[0].name,
			price: rows[0].price,
			type: rows[0].type,
			inventory_items,
		};
		return menu;
	}

	async getAllMenuItems() {
		const { rows } = await pool.query("SELECT * FROM menu;");
		const menuItems = [];
		for (const row of rows) {
			const inventory_items = await getInventoryItemsByMenuId(
				row.menu_id
			);
			const item = {
				menu_id: row.menu_id,
				name: row.name,
				price: row.price,
				type: row.type,
				inventory_items,
			};
			menuItems.push(item);
		}
		return menuItems;
	}

	async getMenuByType(foodType) {
		const { rows } = await pool.query(
			"SELECT * FROM menu WHERE type = $1;",
			[foodType]
		);
		const menuItems = [];
		for (const row of rows) {
			const inventory_items = await getInventoryItemsByMenuId(
				row.menu_id
			);
			const item = {
				menu_id: row.menu_id,
				name: row.name,
				price: row.price,
				type: row.type,
				inventory_items,
			};
			menuItems.push(item);
		}
		return menuItems;
	}

	async getInventory(inventory_id) {
		const { rows } = await pool.query(
			"SELECT * FROM inventory WHERE inventory_id = " + inventory_id + ";"
		);
		return rows;
	}

	async getInventoryByName(name) {
		const { rows } = await pool.query(
			"SELECT * FROM inventory WHERE name = $1;",
			[name]
		);
		return rows[0];
	}

	async getAllInventoryItems() {
		const { rows } = await pool.query("SELECT * FROM inventory;");
		return rows;
	}

	async getRestaurant() {
		const { rows } = await pool.query("SELECT * FROM restaurant;");
		return rows;
	}

	async getMenuItemsByInventoryId(inventory_id) {
		const { rows } = await pool.query(
			"SELECT * FROM inventory_to_menu WHERE inventory_id = $1;",
			[inventory_id]
		);
		const menuItems = [];
		for (const row of rows) {
			const menu_item = await getMenu(row.menu_id);
			menuItems.push(menu_item);
		}
		return menuItems;
	}

	async getInventoryItemsByMenuId(menu_id) {
		const { rows } = await pool.query(
			"SELECT * FROM inventory_to_menu WHERE menu_id = $1;",
			[menu_id]
		);
		const inventoryItems = [];
		for (const row of rows) {
			const inventory_item = await getInventory(row.inventory_id);
			inventoryItems.push(inventory_item);
		}
		return inventoryItems;
	}

	async getOrdersByMenuId(menu_id) {
		const { rows } = await pool.query(
			"SELECT * FROM menu_to_order WHERE menu_id = $1;",
			[menu_id]
		);
		const orderItems = [];
		for (const row of rows) {
			const order_item = await getOrder(row.order_id);
			orderItems.push(order_item);
		}
		return orderItems;
	}

	async getMenuItemsByOrderId(order_id) {
		const { rows } = await pool.query(
			"SELECT * FROM menu_to_order WHERE order_id = $1;",
			[order_id]
		);
		const menuItems = [];
		for (const row of rows) {
			const menu_item = await getMenu(row.menu_id);
			menuItems.push(menu_item);
		}
		return menuItems;
	}

	async makeOrder(cost_total, timestamp, customer_id, staff_id, menu_items) {
		try {
			const { rows } = await pool.query(
				"INSERT INTO orders (cost_total, date, customer_id, staff_id) VALUES ($1, $2, $3, $4) RETURNING order_id;",
				[cost_total, timestamp, customer_id, staff_id]
			);
			const order_id = rows[0].order_id;

			for (const item of menu_items) {
				await pool.query(
					"INSERT INTO menu_to_order (menu_id, order_id, quantity) VALUES ($1, $2, $3);",
					[item.first, order_id, item.second]
				);
			}

			for (const item of menu_items) {
				const { rows: inventoryItems } = await pool.query(
					"SELECT * FROM inventory_to_menu WHERE menu_id = $1;",
					[item.first]
				);

				for (const inventoryItem of inventoryItems) {
					await pool.query(
						"UPDATE inventory SET quantity = quantity - $1 WHERE inventory_id = $2;",
						[
							inventoryItem.quantity * item.second,
							inventoryItem.inventory_id,
						]
					);
				}
			}

			return order_id;
		} catch (error) {
			console.error("Error while creating order:", error);
			return -1;
		}
	}

	/**
	 * Removes order and make all necessary changes to database and
	 * - removes all corresponding menu_to_order entries
	 * - removes order entry into orders table
	 *
	 * @param order_id a int for order_id to search by
	 * @return a boolean value for success (true) or failure (false)
	 */
	async removeOrder(order_id) {
		const sqlStatement1 = "DELETE FROM menu_to_order WHERE order_id = $1;";

		try {
			await pool.query(sqlStatement1, [order_id]);
		} catch (e) {
			console.error(
				"Above error happened while deleting menu_to_order entry (called from removeOrder)."
			);
			console.error(`${e.constructor.name}: ${e.message}`);
			return false; // ERROR
		}

		const sqlStatement2 = "DELETE FROM orders WHERE order_id = $1;";
		try {
			await pool.query(sqlStatement2, [order_id]);
		} catch (e) {
			console.error("Above error happened while deleting order entry.");
			console.error(`${e.constructor.name}: ${e.message}`);
			return false; // ERROR
		}

		return true;
	}

	/**
	 * Adds a menu item and make all necessary changes to database and
	 * - adds new menu entry into menu table
	 * - adds all inventory_to_menu entries
	 *
	 * @param name            a name for the new menu item
	 * @param price           a double for price of the menu item
	 * @param type            a string for type of the menu item
	 * @param inventory_items an Array of pairs {inventoryId: Integer, quantity: Integer}
	 *                        for inventory_items in the menu item
	 * @return a boolean value for success (true) or failure (false)
	 */
	async addMenuItem(name, price, type, inventory_items) {
		// Make Menu Entry
		const sqlStatement1 =
			"INSERT INTO menu (name, price, type) VALUES ($1, $2, $3) RETURNING menu_id;";

		let menu_id = -1;
		try {
			const { rows } = await pool.query(sqlStatement1, [
				name,
				price,
				type,
			]);
			if (rows.length > 0) {
				menu_id = rows[0].menu_id;
				console.log("new menuItem with menuid: " + menu_id);
			}
		} catch (e) {
			console.error("Above error happened while creating order entry.");
			console.error(`${e.constructor.name}: ${e.message}`);
			return false;
		}

		// Make inventory_to_menu Entry(ies)
		for (let i = 0; i < inventory_items.length; i++) {
			const sqlStatement2 =
				"INSERT INTO inventory_to_menu (inventory_id, menu_id, quantity) VALUES ($1, $2, $3);";
			try {
				await pool.query(sqlStatement2, [
					inventory_items[i].inventoryId,
					menu_id,
					inventory_items[i].quantity,
				]);
			} catch (e) {
				console.error(
					"Above error happened while creating inventory_to_menu entry."
				);
				console.error(`${e.constructor.name}: ${e.message}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Removes a menu item and make all necessary changes to database and
	 * - removes all corresponding inventory_to_menu entries
	 * - removes all corresponding menu_to_order entries
	 * - removes menu entry from menu table
	 *
	 * @param menu_id a menu_id to search by
	 * @return a boolean value for success (true) or failure (false)
	 */
	async removeMenuItem(menu_id) {
		const sqlStatement1 =
			"DELETE FROM inventory_to_menu WHERE menu_id = $1;";

		try {
			await pool.query(sqlStatement1, [menu_id]);
		} catch (e) {
			console.error(
				"Above error happened while deleting inventory_to_menu entry (called from removeMenuItem)."
			);
			console.error(`${e.constructor.name}: ${e.message}`);
			return false; // ERROR
		}

		const sqlStatement2 = "DELETE FROM menu_to_order WHERE menu_id = $1;";
		try {
			await pool.query(sqlStatement2, [menu_id]);
		} catch (e) {
			console.error(
				"Above error happened while deleting menu_to_order entry (called from removeMenuItem)."
			);
			console.error(`${e.constructor.name}: ${e.message}`);
			return false; // ERROR
		}

		const sqlStatement3 = "DELETE FROM menu WHERE menu_id = $1;";
		try {
			await pool.query(sqlStatement3, [menu_id]);
		} catch (e) {
			console.error("Above error happened while deleting menu entry.");
			console.error(`${e.constructor.name}: ${e.message}`);
			return false; // ERROR
		}

		return true;
	}

	/**
	 * Updates a menu item and sets its price.
	 *
	 * @param menu_id  a menu_id to search by
	 * @param newPrice a new price to set
	 * @return a boolean value for success (true) or failure (false)
	 */
	async updateMenuPriceById(menu_id, newPrice) {
		const query = "UPDATE menu SET price = $1 WHERE menu_id = $2;";

		try {
			await pool.query(query, [newPrice, menu_id]);
			return true; // SUCCESS
		} catch (e) {
			console.error(`${e.constructor.name}: ${e.message}`);
		}
		return false; // ERROR
	}

	/**
	 * Updates a menu item and sets its price.
	 *
	 * @param name     a name to search by
	 * @param newPrice a new price to set
	 * @return a boolean value for success (true) or failure (false)
	 */
	async updateMenuPriceByName(name, newPrice) {
		const query = "UPDATE menu SET price = $1 WHERE name = $2;";

		try {
			await pool.query(query, [newPrice, name]);
			return true; // SUCCESS
		} catch (e) {
			console.error(`${e.constructor.name}: ${e.message}`);
		}
		return false; // ERROR
	}

    
}

export default Data;