'use strict';

const Controller = require('egg').Controller;

class GroupController extends Controller {
  // 获取群组列表
  async list() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    const page = ctx.params.page ? parseInt(ctx.params.page) : 1;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
    const offset = (page - 1) * limit;

    const rows = await app.model.Group.findAll({
      where: {
        status: 1,
      },
      include: [{
        model: app.model.GroupUser,
        where: {
          user_id: current_user_id,
        },
      }],
    });

    return ctx.apiSuccess(rows);
  }
  // 创建群聊
  async create() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    // 验证参数
    ctx.validate({
      ids: { required: true, type: 'array' },
    });
    const { ids } = ctx.request.body;
    // 验证是否是好友
    const friends = await app.model.Friend.findAll({
      where: {
        user_id: current_user_id,
        friend_id: ids,
      },
      include: [
        {
          model: app.model.User,
          as: 'friendInfo',
          attributes: [ 'nickname', 'username' ],
        },
      ],
    });
    const name = friends.map(item => item.friendInfo.nickname || item.friendInfo.username);
    name.push(ctx.authUser.nickname || ctx.authUser.username);
    if (!friends.length) {
      return ctx.apiFail('请选择需要加入群聊的好友');
    }
    // 创建群聊
    const group = await app.model.Group.create({
      name: name.join(','),
      avatar: '',
      user_id: current_user_id,
    });
    // 加入群聊用户
    const data = friends.map(item => {
      return {
        user_id: item.friend_id,
        group_id: group.id,
      };
    });
    data.unshift({
      user_id: current_user_id,
      group_id: group.id,
    });
    await app.model.GroupUser.bulkCreate(data);

    // 消息推送
    const message = {
      id: new Date().getTime(), // 唯一id,后端生成
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name: ctx.authUser.nickname || ctx.authUser.username, // 发送者昵称
      from_id: current_user_id, // 发送者id

      to_id: group.id, // 接收人/群id
      to_name: group.name, // 接收人/群 昵称
      to_avatar: group.avatar, // 接收人/群 头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: '创建群聊成功,可以开始聊天了', // 消息内容
      options: {}, //  其他参数
      create_time: new Date().getTime(), // 创建时间
      isremove: 0, // 是否撤回
      group,
    };
    data.forEach(item => {
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('ok');
  }

  // 查看群资料
  async info() {
    const { app, ctx } = this;
    const current_user_id = ctx.authUser.id;
    // 验证参数
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群主id',
      },
    });
    const { id } = ctx.params;
    // 群组是否存在
    const group = await app.model.Group.findOne({
      where: {
        status: 1,
        id,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: [ 'user_id', 'nickname' ],
          include: [
            {
              model: app.model.User,
              attributes: [ 'id', 'nickname', 'avatar', 'username' ],
            },
          ],
        },
      ],
    });
    if (!group) {
      return ctx.apiFail('该群聊不存在,或者已被封禁');
    }
    // 当前用户是否是该群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) return ctx.apiFail('你不是该群成员,没有权限');

    ctx.apiSuccess(group);
  }

  // 修改群聊名称
  async rename() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群组id',
      },
      name: {
        required: true,
        type: 'string',
        desc: '群名称',
      },
    });
    const { id, name } = ctx.request.body;
    // 是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
      },
      include: [{
        model: app.model.GroupUser,
        attributes: [ 'user_id', 'nickname' ],
      }],
    });
    if (!group) return ctx.apiFail('该群聊不存在或被封禁');
    // 是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) return ctx.apiFail('你不是该群成员');
    // 验证是否是群主
    if (group.user_id !== current_user_id) return ctx.apiFail('你不是管理员,没有权限');
    // 修改群名称
    group.name = name;
    await group.save();
    // 消息推送
    const from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      id: new Date().getTime(), // 唯一id,后端生成
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人/群id
      to_name: group.name, // 接收人/群 昵称
      to_avatar: group.avatar, // 接收人/群 头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: `${from_name} 修改群聊名称为 ${name}`, // 消息内容
      options: {}, //  其他参数
      create_time: new Date().getTime(), // 创建时间
      isremove: 0, // 是否撤回
      group,
    };
    // 推送消息
    group.group_users.forEach(item => {
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('ok');
  }

  // 推送群公告
  async remark() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群组id',
      },
      remark: {
        required: true,
        type: 'string',
        desc: '群公告',
      },
    });
    const { id, remark } = ctx.request.body;
    // 是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
      },
      include: [{
        model: app.model.GroupUser,
        attributes: [ 'user_id', 'nickname' ],
      }],
    });
    if (!group) return ctx.apiFail('该群聊不存在或被封禁');
    // 是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) return ctx.apiFail('你不是该群成员');
    // 验证是否是群主
    if (group.user_id !== current_user_id) return ctx.apiFail('你不是管理员,没有权限');
    // 修改群公告
    group.remark = remark;
    await group.save();
    // 消息推送
    const from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      id: new Date().getTime(), // 唯一id,后端生成
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人/群id
      to_name: group.name, // 接收人/群 昵称
      to_avatar: group.avatar, // 接收人/群 头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: `[公告] ${remark}`, // 消息内容
      options: {}, //  其他参数
      create_time: new Date().getTime(), // 创建时间
      isremove: 0, // 是否撤回
      group,
    };
    // 推送消息
    group.group_users.forEach(item => {
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('ok');
  }

  // 修改我在本群中的昵称
  async nickname() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群组id',
      },
      nickname: {
        required: true,
        type: 'string',
        desc: '昵称',
        defValue: '',
      },
    });
    const { id, nickname } = ctx.request.body;
    // 是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
      },
      include: [{
        model: app.model.GroupUser,
        attributes: [ 'user_id', 'nickname' ],
      }],
    });
    if (!group) return ctx.apiFail('该群聊不存在或被封禁');
    // 是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) return ctx.apiFail('你不是该群成员');
    // 修改昵称
    const group_user = await app.model.GroupUser.findOne({
      where: {
        user_id: current_user_id,
        group_id: group.id,
      },
    });
    if (group_user) {
      await group_user.update({ nickname });
    }
    ctx.apiSuccess('ok');
  }

  // 删除并退出群聊
  async quit() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群组id',
      },
    });
    const { id } = ctx.request.body;
    // 是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
      },
      include: [{
        model: app.model.GroupUser,
        attributes: [ 'user_id', 'nickname' ],
      }],
    });
    if (!group) return ctx.apiFail('该群聊不存在或被封禁');
    // 是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) return ctx.apiFail('你不是该群成员');

    const from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      id: new Date().getTime(), // 唯一id,后端生成
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人/群id
      to_name: group.name, // 接收人/群 昵称
      to_avatar: group.avatar, // 接收人/群 头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: '', // 消息内容
      options: {}, //  其他参数
      create_time: new Date().getTime(), // 创建时间
      isremove: 0, // 是否撤回
      group,
    };


    if (group.user_id === current_user_id) {
      // 解散群
      message.data = '该群已被解散';
      await app.model.Group.destroy({
        where: {
          id,
        },
      });
    } else {
      // 退出群
      message.data = `${from_name} 退出该群聊`;
      await app.model.GroupUser.destroy({
        where: {
          user_id: current_user_id,
          group_id: id,
        },
      });
    }
    // 推送消息
    group.group_users.forEach(item => {
      ctx.sendAndSaveMessage(item.user_id, message);
    });

    ctx.apiSuccess('ok');
  }

  // 生成群二维码
  async qrcode() {
    const { ctx, app } = this;
    ctx.qecode(JSON.stringify({
      id: 1,
    }));
  }
}

module.exports = GroupController;
