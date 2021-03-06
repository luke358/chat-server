'use strict';

const Controller = require('egg').Controller;

class SearchController extends Controller {
  // 搜索用户
  async searchUser() {
    const { ctx, app } = this;

    // 参数验证
    ctx.validate({
      keyWord: { type: 'string', required: true, desc: '搜索关键字' },
    });

    const { keyWord } = ctx.request.body;
    const data = await app.model.User.findOne({
      where: {
        username: keyWord,
      },
      attributes: {
        exclude: [ 'password' ],
      },
    });
    ctx.apiSuccess(data);
  }
}

module.exports = SearchController;
