'use strict';

const qr = require('qr-image');

module.exports = {
  // 成功提示
  apiSuccess(data = '', msg = 'ok', code = 200) {
    this.body = { msg, data };
    this.status = code;
  },
  // 失败提示
  apiFail(data = '', msg = 'fail', code = 400) {
    this.body = { msg, data };
    this.status = code;
  },
  // 生成token
  async getToken(value) {
    return this.app.jwt.sign(value, this.app.config.jwt.secret);
  },
  // 验证token
  checkToken(token) {
    return this.app.jwt.verify(token, this.app.config.jwt.secret);
  },
  // 发送或者存放消息队列中
  sendAndSaveMessage(to_id, message, msg = 'ok') {
    const { app, service } = this;
    const current_user_id = this.authUser.id;
    // 拿到对方的socket
    // 验证对方是否在线？不在线记录到待接收消息队列中， 在线，消息推送，存储到对方的聊天记录中 chatlog_对方用户id_user当前用户id
    if (app.ws.user && app.ws.user[to_id]) {
      const socket = app.ws.user[to_id];
      socket.send(JSON.stringify({
        msg,
        data: message,
      }));
      // 存到历史记录当中
      service.cache.setList(`chatlog_${to_id}_${message.chat_type}_${current_user_id}`, message);
    } else {
      service.cache.setList('getmessage_' + to_id, message);
    }
  },
  // 生成二维码
  qecode(url) {
    const img = qr.image(url, { size: 10 });
    this.response.type = 'image/png';
    this.body = img;
  },
  genID(length) {
    return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
  },
};
