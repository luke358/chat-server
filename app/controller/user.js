'use strict';

const Controller = require('egg').Controller;
const crypto = require('crypto');

class UserController extends Controller {
  // 注册
  async reg() {
    const { ctx, app } = this;

    // 参数验证
    ctx.validate({
      username: { type: 'string', range: { min: 8, max: 15 }, required: true, desc: '用户名' },
      password: { type: 'string', required: true, desc: '密码' },
      repassword: { type: 'string', required: true, desc: '确认密码' },
    }, {
      equals: [
        [ 'password', 'repassword' ],
      ],
    });
    // ctx.throw(400, x);
    const { username, password } = ctx.request.body;

    // 验证用户是否已经存在
    if (await app.model.User.findOne({
      where: {
        username,
      },
    })) {
      ctx.throw(400, '用户名已存在');
    }
    // 创建用户
    const user = await app.model.User.create({ username, password });
    if (!user) {
      ctx.throw(400, '创建用户失败');
    }
    ctx.apiSuccess(user);
  }
  // 登陆
  async login() {
    const { ctx, app } = this;

    // 参数验证
    ctx.validate({
      username: { type: 'string', range: { min: 8, max: 15 }, required: true, desc: '用户名' },
      password: { type: 'string', required: true, desc: '密码' },
    });
    // 验证用户是否存在
    // 验证用户状态
    const { username, password } = ctx.request.body;
    let user = await app.model.User.findOne({
      where: {
        username,
        status: 1,
      },
    });
    if (!user) {
      ctx.throw(400, '用户不存在或已被警用');
    }
    // 验证密码
    await this.checkPassword(password, user.password);
    // 生成token
    user = JSON.parse(JSON.stringify(user));
    const token = await ctx.getToken(user);
    user.token = token;
    delete user.password;
    // 加入到缓存中
    if (!await this.service.cache.set('user_' + user.id, token)) {
      ctx.throw(400, '登陆失败');
    }
    // 返回用户信息和token
    ctx.apiSuccess(user);
  }

  // 验证密码
  async checkPassword(password, hash_password) {
  // 先对需要验证的密码进行加密
    const hmac = crypto.createHash('sha256', this.config.crypto.secret);
    hmac.update(password);
    password = hmac.digest('hex');
    const res = password === hash_password;
    if (!res) {
      this.ctx.throw(400, '密码错误');
    }
    return true;
  }

  // 退出登陆
  async logout() {
    const { ctx, service } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;
    // 移出redis当前用户信息
    if (!await service.cache.remove('user_' + current_user_id)) {
      ctx.throw(400, '退出登陆失败');
    }
    ctx.apiSuccess('退出成功');
  }

  // 生成个人二维码
  async qrcode() {
    const { ctx, app } = this;
    ctx.qecode(JSON.stringify({
      id: 1,
    }));
  }

  // 修改个人资料
  async update() {
    const { ctx, app } = this;

    ctx.validate({
      avatar: {
        type: 'url', required: false, desc: '头像',
      },
      nickname: {
        type: 'string', required: false, desc: '昵称',
      },
    });

    const { avatar, nickname } = ctx.request.body;
    avatar && (ctx.authUser.avatar = avatar);
    nickname && (ctx.authUser.nickname = nickname);
    (avatar || nickname) && (await ctx.authUser.save());

    ctx.apiSuccess('ok');
  }

}

module.exports = UserController;
