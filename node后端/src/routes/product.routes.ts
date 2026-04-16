import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, merchantOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as productService from '../services/product.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });
const storeIdParam = Joi.object({ storeId: Joi.number().integer().positive().required() });

const skuItemSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  specValues: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  specText: Joi.string().max(256).allow(''),
  priceFen: Joi.number().integer().min(0).required(),
  originalPriceFen: Joi.number().integer().min(0).optional(),
  stock: Joi.number().integer().min(0).required(),
  skuCode: Joi.string().max(64).allow('').optional(),
});

// ===== 分类（商家）=====

const merchantCats = Router();
merchantCats.use(tokenAuth(), merchantOnly);

router.get(
  '/categories',
  tokenAuth({ optional: true }),
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      onlyActive: Joi.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const onlyActiveRaw = String(req.query.onlyActive ?? '').toLowerCase();
    const onlyActive = onlyActiveRaw === 'true' || onlyActiveRaw === '1';
    const list = await productService.getCategories(
      Number(req.query.storeId),
      onlyActive,
    );
    success(res, { list });
  }),
);

merchantCats.post(
  '/categories',
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      name: Joi.string().max(64).required(),
      icon: Joi.string().max(512).allow(''),
      sort: Joi.number().integer().optional(),
      parentId: Joi.number().integer().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantCreateCategory(req.user!.userId, req.body);
    success(res, data, '分类创建成功', 201);
  }),
);

merchantCats.put(
  '/categories/sort',
  validate({
    body: Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            id: Joi.number().integer().positive().required(),
            sort: Joi.number().integer().required(),
          }),
        )
        .min(1)
        .required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await productService.merchantSortCategories(req.user!.userId, req.body.items);
    success(res, null, '排序已更新');
  }),
);

merchantCats.put(
  '/categories/:id',
  validate({
    params: idParam,
    body: Joi.object({
      name: Joi.string().max(64),
      icon: Joi.string().max(512).allow(''),
      sort: Joi.number().integer(),
      status: Joi.string().valid('ACTIVE', 'INACTIVE'),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantUpdateCategory(
      req.user!.userId,
      Number(req.params.id),
      req.body,
    );
    success(res, data);
  }),
);

merchantCats.delete(
  '/categories/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await productService.merchantDeleteCategory(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, null, '已删除');
  }),
);

// ===== 商品（商家） =====

const merchantProducts = Router();
merchantProducts.use(tokenAuth(), merchantOnly);

merchantProducts.get(
  '/products',
  paginate(),
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().optional(),
      categoryId: Joi.number().integer().positive().optional(),
      status: Joi.string().valid('ON_SHELF', 'OFF_SHELF').optional(),
      keyword: Joi.string().max(64).allow('').optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await productService.merchantListProducts(req.user!.userId, {
      storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      status: req.query.status as 'ON_SHELF' | 'OFF_SHELF' | undefined,
      keyword: req.query.keyword as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

merchantProducts.post(
  '/products',
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      categoryId: Joi.number().integer().positive().required(),
      name: Joi.string().max(128).required(),
      description: Joi.string().allow('').optional(),
      images: Joi.array().items(Joi.string().max(512)).optional(),
      basePriceFen: Joi.number().integer().min(0).required(),
      packingFeeFen: Joi.number().integer().min(0).optional(),
      unit: Joi.string().max(16).optional(),
      minBuy: Joi.number().integer().min(1).optional(),
      maxBuy: Joi.number().integer().min(0).optional(),
      isHot: Joi.boolean().optional(),
      isNew: Joi.boolean().optional(),
      isRecommend: Joi.boolean().optional(),
      skus: Joi.array().items(skuItemSchema).min(1).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantCreateProduct(req.user!.userId, req.body);
    success(res, data, '商品创建成功', 201);
  }),
);

merchantProducts.patch(
  '/products/batch-status',
  validate({
    body: Joi.object({
      ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
      status: Joi.string().valid('ON_SHELF', 'OFF_SHELF').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await productService.merchantBatchToggle(
      req.user!.userId,
      req.body.ids,
      req.body.status,
    );
    success(res, null, '批量操作成功');
  }),
);

merchantProducts.put(
  '/products/:id',
  validate({
    params: idParam,
    body: Joi.object({
      categoryId: Joi.number().integer().positive(),
      name: Joi.string().max(128),
      description: Joi.string().allow(''),
      images: Joi.array().items(Joi.string().max(512)),
      basePriceFen: Joi.number().integer().min(0),
      packingFeeFen: Joi.number().integer().min(0),
      unit: Joi.string().max(16),
      minBuy: Joi.number().integer().min(1),
      maxBuy: Joi.number().integer().min(0),
      isHot: Joi.boolean(),
      isNew: Joi.boolean(),
      isRecommend: Joi.boolean(),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantUpdateProduct(
      req.user!.userId,
      Number(req.params.id),
      req.body,
    );
    success(res, data);
  }),
);

merchantProducts.delete(
  '/products/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await productService.merchantDeleteProduct(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, null, '已删除');
  }),
);

merchantProducts.patch(
  '/products/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('ON_SHELF', 'OFF_SHELF').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await productService.merchantToggleProductStatus(
      req.user!.userId,
      Number(req.params.id),
      req.body.status,
    );
    success(res, null, '状态已切换');
  }),
);

// ===== SKU / 库存（商家） =====

merchantProducts.get(
  '/products/:id/skus',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const list = await productService.merchantListSkus(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, { list });
  }),
);

merchantProducts.put(
  '/products/:id/skus',
  validate({
    params: idParam,
    body: Joi.object({
      skus: Joi.array().items(skuItemSchema).min(1).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantSaveSkus(
      req.user!.userId,
      Number(req.params.id),
      req.body,
    );
    success(res, data);
  }),
);

merchantProducts.patch(
  '/skus/:id/stock',
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('SET', 'INCREMENT', 'DECREMENT').required(),
      quantity: Joi.number().integer().min(0).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantUpdateStock(
      req.user!.userId,
      Number(req.params.id),
      req.body.action,
      req.body.quantity,
    );
    success(res, data);
  }),
);

merchantProducts.patch(
  '/skus/batch-stock',
  validate({
    body: Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            skuId: Joi.number().integer().positive().required(),
            action: Joi.string().valid('SET', 'INCREMENT', 'DECREMENT').required(),
            quantity: Joi.number().integer().min(0).required(),
          }),
        )
        .min(1)
        .required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await productService.merchantBatchUpdateStock(
      req.user!.userId,
      req.body.items,
    );
    success(res, { list: data });
  }),
);

// ===== 用户端公开接口 =====

router.get(
  '/products/:id',
  tokenAuth({ optional: true }),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await productService.getProductDetail(Number(req.params.id));
    success(res, data);
  }),
);

router.get(
  '/stores/:storeId/products',
  tokenAuth({ optional: true }),
  paginate(),
  validate({
    params: storeIdParam,
    query: Joi.object({
      categoryId: Joi.number().integer().positive().optional(),
      keyword: Joi.string().max(64).allow('').optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await productService.userListProducts({
      storeId: Number(req.params.storeId),
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      keyword: req.query.keyword as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.get(
  '/search',
  tokenAuth({ optional: true }),
  paginate(),
  validate({
    query: Joi.object({
      keyword: Joi.string().max(64).required(),
      lat: Joi.number().optional(),
      lng: Joi.number().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await productService.searchProducts({
      keyword: req.query.keyword as string,
      lat: req.query.lat ? Number(req.query.lat) : undefined,
      lng: req.query.lng ? Number(req.query.lng) : undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

// 挂载分类和商品子路由
router.use('/', merchantCats);
router.use('/', merchantProducts);

export default router;
