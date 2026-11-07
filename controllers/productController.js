const Product = require("../models/Product");
const stockMovement = require("../models/stockMovement");

const mongoose = require("mongoose");

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const addProduct = async (req, res, next) => {
  let session;

  try {
    const { name, price, stock, category } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative number",
      });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required and must be a non-empty string",
      });
    }

    session = await mongoose.startSession();

    let newProduct;

    await session.withTransaction(async () => {
      const [createdProduct] = await Product.create(
        [
          {
            name,
            price,
            stock,
            category,
          },
        ],
        { session },
      );

      await stockMovement.create(
        [
          {
            product: createdProduct._id,
            previousStock: 0,
            newStock: stock,
            quantityChanged: stock,
            reason: "Initial stock",
            performedBy: req.user._id,
          },
        ],
        { session },
      );

      newProduct = createdProduct;
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: newProduct,
    });
  } catch (error) {
    next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const getProduct = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 5);

    //Price query
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;

    //Sorting query
    const sortBy = req.query.sortBy || "_id";
    const order = req.query.order || "asc";

    //Price Validation
    if (minPrice !== undefined && isNaN(Number(minPrice))) {
      return res.status(400).json({
        success: false,
        message: "minPrice must be a valid number",
      });
    }

    if (maxPrice !== undefined && isNaN(Number(maxPrice))) {
      return res.status(400).json({
        success: false,
        message: "maxPrice must be a valid number",
      });
    }

    // Validate negative values (Price)
    if (minPrice !== undefined && Number(minPrice) < 0) {
      return res.status(400).json({
        success: false,
        message: "minPrice cannot be negative",
      });
    }

    if (maxPrice !== undefined && Number(maxPrice) < 0) {
      return res.status(400).json({
        success: false,
        message: "maxPrice cannot be negative",
      });
    }

    //minimum isn't greater than maximum (Price)
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      Number(minPrice) > Number(maxPrice)
    ) {
      return res.status(400).json({
        success: false,
        message: "minPrice cannot be greater than maxPrice",
      });
    }

    //Stock query
    const minStock = req.query.minStock;
    const maxStock = req.query.maxStock;

    //Stock Validation
    if (minStock !== undefined && isNaN(Number(minStock))) {
      return res.status(400).json({
        success: false,
        message: "minStock must be a valid number",
      });
    }

    if (maxStock !== undefined && isNaN(Number(maxStock))) {
      return res.status(400).json({
        success: false,
        message: "maxStock must be a valid number",
      });
    }

    // Validate negative values (Stock)
    if (minStock !== undefined && Number(minStock) < 0) {
      return res.status(400).json({
        success: false,
        message: "minStock cannot be negative",
      });
    }

    if (maxStock !== undefined && Number(maxStock) < 0) {
      return res.status(400).json({
        success: false,
        message: "maxStock cannot be negative",
      });
    }

    //minimum isn't greater than maximum (Stock)
    if (
      minStock !== undefined &&
      maxStock !== undefined &&
      Number(minStock) > Number(maxStock)
    ) {
      return res.status(400).json({
        success: false,
        message: "minStock cannot be greater than maxStock",
      });
    }

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
    }

    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a positive integer",
      });
    }

    if (limit > 1000) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot be greater than 100",
      });
    }

    //Validate sorting
    const allowedSortFields = ["name", "price", "stock", "category", "_id"];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort field",
      });
    }

    if (!["asc", "desc"].includes(order)) {
      return res.status(400).json({
        success: false,
        message: "Order must be asc or desc",
      });
    }

    const skip = (page - 1) * limit;

    //Filter
    const filter = {};

    //search Validation
    const search = req.query.search;

    if (search !== undefined && typeof search !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search must be a string",
      });
    }

    if (search !== undefined && search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search cannot exceed 100 characters",
      });
    }

    //Search filter
    if (search && search.trim()) {
      filter.name = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };
    }

    // Price Filter
    if (minPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $gte: Number(minPrice),
      };
    }

    if (maxPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $lte: Number(maxPrice),
      };
    }

    //Stock filter
    if (minStock !== undefined) {
      filter.stock = {
        ...filter.stock,
        $gte: Number(minStock),
      };
    }

    if (maxStock !== undefined) {
      filter.stock = {
        ...filter.stock,
        $lte: Number(maxStock),
      };
    }

    //Category Filter
    const category = req.query.category;

    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category must be a non-empty string",
        });
      }
      filter.category = category.trim().toLowerCase();
    }

    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };
    if (sortBy !== "_id") {
      sortOptions._id = 1;
    }

    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    //Pagination
    const totalProducts = await Product.countDocuments(filter);

    const totalUnitsResult = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: "$stock" },
        },
      },
    ]);

    const totalUnits = totalUnitsResult[0]?.totalUnits || 0;

    const totalPages = Math.ceil(totalProducts / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    const currentPageProducts = products.length;

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: products,
      pagination: {
        page,
        limit,
        totalProducts,
        totalUnits,
        totalPages,
        currentPageProducts,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Low stock alert code
const getLowStockProducts = async (req, res, next) => {
  try {
    const thresholdQuery = req.query.threshold;
    let threshold = 5; // Default threshold

    if (thresholdQuery !== undefined) {
      const parsedThreshold = Number(thresholdQuery);
      if (
        isNaN(parsedThreshold) ||
        parsedThreshold < 0 ||
        !Number.isInteger(parsedThreshold)
      ) {
        return res.status(400).json({
          success: false,
          message: "Threshold must be a non-negative integer",
        });
      }
      threshold = parsedThreshold;
    }

    const lowStockProducts = await Product.find({
      stock: { $lte: threshold },
    }).sort({ stock: 1 });

    res.status(200).json({
      success: true,
      message: `Products with stock less than or equal to ${threshold}`,
      count: lowStockProducts.length,
      data: lowStockProducts,
    });
  } catch (error) {
    next(error);
  }
};

const getProductCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct("category");

    const filteredCategories = categories
      .filter((category) => typeof category === "string" && category.trim())
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      message: "Product categories fetched successfully",
      data: filteredCategories,
    });
  } catch (error) {
    next(error);
  }
};

const getStockHistory = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
    }

    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a positive integer",
      });
    }

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot be greater than 100",
      });
    }

    const skip = (page - 1) * limit;

    const totalRecords = await stockMovement.countDocuments();

    const history = await stockMovement
      .find()
      .populate("product", "name")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    res.status(200).json({
      success: true,
      message: "Stock history fetched successfully",
      count: history.length,
      data: history,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const id = req.params.id;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Your Product",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  let session;

  try {
    const id = req.params.id;
    const { name, price, stock, category, reason } = req.body;

    // Step 1: Validate the incoming data.
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative number",
      });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required and must be a non-empty string",
      });
    }

    // Step 2: Start a MongoDB transaction.
    session = await mongoose.startSession();

    let updatedProduct = null;

    await session.withTransaction(async () => {
      // Step 3: Find the existing product.
      const product = await Product.findById(id).session(session);

      if (!product) {
        return;
      }

      // Remember the stock before changing it.
      const previousStock = product.stock;

      // Step 4: Update the product fields.
      product.name = name;
      product.price = price;
      product.stock = stock;
      product.category = category;

      await product.save({ session });

      // Step 5: Create history only if stock changed.
      if (previousStock !== stock) {
        await stockMovement.create(
          [
            {
              product: product._id,
              previousStock,
              newStock: stock,
              quantityChanged: stock - previousStock,
              reason: reason || "Stock updated via product edit",
              performedBy: req.user._id,
            },
          ],
          { session },
        );
      }

      updatedProduct = product;
    });

    // Step 6: Return 404 if the product doesn't exist.
    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Step 7: Send the successful response.
    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const patchProduct = async (req, res, next) => {
  let session;
  try {
    const id = req.params.id;

    const { name, price, stock, category, reason } = req.body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Name must be a valid non-empty string",
      });
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative number",
      });
    }

    if (
      category !== undefined &&
      (typeof category !== "string" || !category.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Category must be a non-empty string",
      });
    }

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (price !== undefined) {
      updateData.price = price;
    }

    if (stock !== undefined) {
      updateData.stock = stock;
    }
    if (category !== undefined) {
      updateData.category = category;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    session = await mongoose.startSession();

    let updatedProduct = null;

    await session.withTransaction(async () => {

      const product = await Product.findById(id).session(session);

      if (!product) {
        return;
      }

      const previousStock = product.stock;

      Object.assign(product, updateData);

      await product.save({ session });

      const quantityChanged = product.stock - previousStock;

      if (quantityChanged !== 0) {
        await stockMovement.create(
          [
          {
            product: product._id,
            previousStock,
            newStock: product.stock,
            quantityChanged,
            reason: reason || "Stock updated via partial edit",
            performedBy: req.user._id,
          },
          ],
          { session },
        );
      }
      updatedProduct = product;
    });

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }

  finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  addProduct,
  getProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  patchProduct,
  getLowStockProducts,
  getProductCategories,
  getStockHistory,
};
