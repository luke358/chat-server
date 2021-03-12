'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);

  // user.js
  // 用户注册
  router.post('/reg', controller.user.reg);
  // 用户登陆
  router.post('/login', controller.user.login);
  // 退出登陆
  router.post('/logout', controller.user.logout);
  // 生成用户二维码
  router.get('/user_qrcode/:id', controller.user.qrcode);
  // 修改用户个人资料
  router.post('/user/update', controller.user.update);


  // search.js
  // 搜索用户
  router.post('/search/user', controller.search.searchUser);

  // apply.js
  // 添加好友
  router.post('/apply/addfriend', controller.apply.addFriend);
  // 好友申请列表
  router.get('/apply/:page', controller.apply.list);
  // 好友申请处理
  router.post('/apply/handle/:id', controller.apply.handle);

  // friend.js
  // 通讯录列表
  router.get('/friend/list', controller.friend.list);
  // 查看用户资料
  router.get('/friend/read/:id', controller.friend.read);
  // 设置/取消黑名单
  router.post('/friend/setblack/:id', controller.friend.setBlack);
  // 设置/取消星标
  router.post('/friend/setstar/:id', controller.friend.setStar);
  // 设置盆友圈权限
  router.post('/friend/setmomentauth/:id', controller.friend.setMomentAuth);
  // 设置备注和标签
  router.post('/friend/setremarktag/:id', controller.friend.setRemarkTag);
  // 删除好于
  router.post('/friend/destroy', controller.friend.destroy);


  // report.js
  // 举报
  router.post('/report/save', controller.report.save);

  // group.js
  // 创建群聊
  router.post('/group/create', controller.group.create);
  // 查询群组
  router.get('/group/:page', controller.group.list);
  // 获取群资料
  router.get('/group_info/:id', controller.group.info);
  // 修改群名称
  router.post('/group/rename', controller.group.rename);
  // 修改群公告
  router.post('/group/remark', controller.group.remark);
  // 修改我在群中的昵称
  router.post('/group/nickname', controller.group.nickname);
  // 删除或退出群聊
  router.post('/group/quit', controller.group.quit);
  // 生成群二维码
  router.get('/group_qrcode/:id', controller.group.qrcode);

  // common.js
  // 上传文件
  router.post('/upload', controller.common.upload);

  // fava.js
  // 创建收藏
  router.post('/fava/create', controller.fava.create);
  // 收藏列表
  router.get('/fava/:page', controller.fava.list);
  // 删除收藏
  router.post('/fava/destroy', controller.fava.destroy);

  // chat.js
  // 发送消息
  router.post('/chat/send', controller.chat.send);
  // 获取离线消息
  router.post('/chat/getmessage', controller.chat.getMessage);
  // 撤回消息
  router.post('/chat/recall', controller.chat.recall);


  // websocket

  app.ws.use(async (ctx, next) => {
    // 获取参数 ws://localhost:7001/ws?token=123456
    // ctx.query.token
    // 验证用户token
    let user = {};
    const token = ctx.query.token;
    try {
      user = ctx.checkToken(token);
      // 验证用户状态
      const userCheck = await app.model.User.findByPk(user.id);
      if (!userCheck) {
        ctx.websocket.send(JSON.stringify({
          msg: 'fail',
          data: '用户不存在',
        }));
        return ctx.websocket.close();
      }
      if (!userCheck.status) {
        ctx.websocket.send(JSON.stringify({
          msg: 'fail',
          data: '你已被禁用',
        }));
        return ctx.websocket.close();
      }
      // 用户上线
      app.ws.user = app.ws.user ? app.ws.user : {};
      // 下线其他设备
      if (app.ws.user[user.id]) {
        app.ws.user[user.id].send(JSON.stringify({
          msg: 'fail',
          data: '你的账号在其他设备登录',
        }));
        app.ws.user[user.id].close();
      }
      // 记录当前用户id
      ctx.websocket.user_id = user.id;
      app.ws.user[user.id] = ctx.websocket;
      await next();
    } catch (err) {
      console.log(err);
      const fail = err.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
      ctx.websocket.send(JSON.stringify({
        msg: 'fail',
        data: fail,
      }));
      // 关闭连接
      ctx.websocket.close();
    }
  });

  // 路由配置
  app.ws.route('/ws', controller.chat.connect);


};
