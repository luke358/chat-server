'use strict';

const Controller = require('egg').Controller;

class FavaController extends Controller {
  // 创建收藏
  async create() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    // 参数验证
    ctx.validate({
      type: { type: 'string', range: { in: [ 'text', 'image', 'video', 'emoticon', 'card' ] }, required: true, desc: '消息类型' },
      data: { type: 'string', required: true, desc: '消息内容' },
      options: { type: 'string', required: true },
    });
    const { type, data, options } = ctx.request.body;
    await app.model.Fava.create({
      type, data, options, user_id: current_user_id,
    });
    ctx.apiSuccess('ok');
  }
  // 收藏列表
  async list() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    const page = ctx.params.page ? parseInt(ctx.params.page) : 1;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
    const offset = (page - 1) * limit;

    const rows = await app.model.Fava.findAll({
      where: {
        user_id: current_user_id,
      },
      offset,
      limit,
      order: [
        [ 'id', 'desc' ],
      ],
    });
    ctx.apiSuccess(rows);
  }
  // 删除收藏
  async destroy() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    ctx.validate({
      id: { required: true, type: 'int' },
    });

    const { id } = ctx.request.body;
    await app.model.Fava.destroy({
      where: {
        id, user_id: current_user_id,
      },
    });

    ctx.apiSuccess('ok');
  }
}

module.exports = FavaController;
