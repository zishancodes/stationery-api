const express = require("express");
const router = express.Router();
const {
  addProduct,
  getProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  patchProduct,
  getLowStockProducts,
  getProductCategories,
  getStockHistory,
} = require("../controllers/productController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authorize");

/**
 * @openapi
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - stock
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a8e1b2f4c3d2e1a0b9c8d7
 *         name:
 *           type: string
 *           example: Gel Ink Rollerball Pen
 *         price:
 *           type: number
 *           example: 45
 *         stock:
 *           type: integer
 *           example: 10
 *         category:
 *           type: string
 *           example: pens
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - stock
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fountain Pen - Black
 *               price:
 *                 type: number
 *                 example: 250
 *               stock:
 *                 type: integer
 *                 example: 15
 *               category:
 *                 type: string
 *                 example: pens
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid input or missing fields
 *
 *   get:
 *     summary: Retrieve products with search, filters, sorting, and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive search on product name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by exact category name
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: minStock
 *         schema:
 *           type: number
 *         description: Minimum stock filter
 *       - in: query
 *         name: maxStock
 *         schema:
 *           type: number
 *         description: Maximum stock filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: _id
 *         description: Field to sort by (name, price, stock, category, _id)
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sorting direction
 *     responses:
 *       200:
 *         description: List of products returned successfully
 *       400:
 *         description: Invalid query parameters
 */
router.post("/products", protect, authorize("admin"), addProduct);

router.get("/products", protect, getProduct);

router.get("/products/categories", protect,  getProductCategories);

router.get("/stock-history", protect, getStockHistory);

/**
 * @openapi
 * /api/products/low-stock:
 *   get:
 *     summary: Retrieve products with stock at or below a threshold
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Maximum stock threshold (inclusive)
 *     responses:
 *       200:
 *         description: Low stock products fetched successfully
 *       400:
 *         description: Invalid threshold parameter
 */
router.get("/products/low-stock", protect, getLowStockProducts);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the product
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *       404:
 *         description: Product not found
 *
 *   put:
 *     summary: Full update of a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Missing required fields or invalid input
 *       404:
 *         description: Product not found
 *
 *   patch:
 *     summary: Partial update of a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product patched successfully
 *       400:
 *         description: Invalid field value or empty update body
 *       404:
 *         description: Product not found
 *
 *   delete:
 *     summary: Delete a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.get("/products/:id", protect, getProductById);

router.put("/products/:id", protect, authorize("admin"), updateProduct);

router.patch("/products/:id", protect, authorize("admin"), patchProduct);

router.delete("/products/:id", protect, authorize("admin"), deleteProduct);

module.exports = router;
