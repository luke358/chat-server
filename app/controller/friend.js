'use strict';

const Controller = require('egg').Controller;
const SortWord = require('sort-word');
class FriendController extends Controller {
  // 通讯录列表
  async list() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;

    // 获取并统计我的好友
    const friends = await app.model.Friend.findAndCountAll({
      where: {
        user_id: current_user_id,
      },
      include: [
        {
          model: app.model.User,
          as: 'friendInfo',
          attributes: [ 'id', 'username', 'nickname', 'avatar' ],
        },
      ],
    });
    const res = friends.rows.map(item => {
      let name = item.friendInfo.nickname ? item.friendInfo.nickname : item.friendInfo.username;
      if (item.nickname) {
        name = item.nickname;
      }
      return {
        id: item.id,
        user_id: item.friendInfo.id,
        name,
        username: item.friendInfo.username,
        avatar: item.friendInfo.avatar,
      };
    });

    // 排序
    friends.rows = new SortWord(res, 'name');
    ctx.apiSuccess(friends);
  }

  // 查看用户资料
  async read() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;

    const user_id = parseInt(ctx.params.id);

    const user = await app.model.User.findOne({
      where: {
        id: user_id,
        status: 1,
      },
      attributes: {
        exclude: [ 'password' ],
      },
    });

    if (!user) {
      ctx.throw(400, '用户不存在');
    }

    let res = {
      id: user.id,
      username: user.username,
      nickname: user.nickname ? user.nickname : user.username,
      avatar: user.avatar,
      sex: user.sex,
      sign: user.sign,
      area: user.area,
      friend: false,
    };

    const friend = await app.model.Friend.findOne({
      where: {
        user_id: current_user_id,
        friend_id: user_id,
      },
      include: [
        {
          model: app.model.Tag,
          attributes: [ 'name' ],
        },
      ],
    });
    if (friend) {
      res.friend = true;
      if (friend.nickname) {
        res.nickname = friend.nickname;
      }
      res = {
        ...res,
        lookme: friend.lookme,
        lookhim: friend.lookhim,
        star: friend.star,
        isblack: friend.isblack,
        tags: friend.tags.map(item => item.name),
      };
    }
    ctx.apiSuccess(res);
  }

  // 移入/移出黑名单
  async setBlack() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;
    const id = parseInt(ctx.params.id);

    // 参数验证
    ctx.validate({
      isblack: {
        type: 'int',
        range: { in: [ 0, 1 ] },
        required: true,
        desc: '移入/移出黑名单',
      },
    });

    const friend = await app.model.Friend.findOne({
      where: {
        friend_id: id,
        user_id: current_user_id,
      },
    });
    if (!friend) {
      ctx.throw(400, '该记录不存在');
    }

    friend.isblack = ctx.request.body.isblack;
    await friend.save();

    ctx.apiSuccess('ok');
  }

  // 设置/取消星标
  async setStar() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;

    const id = parseInt(ctx.params.id);

    // 参数验证
    ctx.validate({
      star: {
        type: 'int',
        range: { in: [ 0, 1 ] },
        required: true,
        desc: '设置/取消黑名单',
      },
    });

    const friend = await app.model.Friend.findOne({
      where: {
        friend_id: id,
        user_id: current_user_id,
        isblack: 0,
      },
    });
    if (!friend) {
      ctx.throw(400, '该记录不存在');
    }

    friend.star = ctx.request.body.star;
    await friend.save();
    ctx.apiSuccess('ok');
  }

  // 设置盆友圈全校
  async setMomentAuth() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;

    const id = parseInt(ctx.params.id);
    // 参数验证
    ctx.validate({
      lookhim: {
        type: 'int',
        range: { in: [ 0, 1 ] },
        required: true,
        desc: '看他',
      },
      lookme: {
        type: 'int',
        range: { in: [ 0, 1 ] },
        required: true,
        desc: '看我',
      },
    });
    const { lookme, lookhim } = ctx.request.body;
    const friend = await app.model.Friend.findOne({
      where: {
        friend_id: id,
        user_id: current_user_id,
        isblack: 0,
      },
    });
    if (!friend) {
      ctx.throw(400, '该记录不存在');
    }

    friend.lookhim = lookhim;
    friend.lookme = lookme;

    await friend.save();

    ctx.apiSuccess('ok');
  }

  // 设置备注和标签
  async setRemarkTag() {
    const { ctx, app } = this;
    // 获取用户id
    const current_user_id = ctx.authUser.id;

    const id = parseInt(ctx.params.id);

    // 参数验证
    ctx.validate({
      nickname: {
        type: 'string',
        required: false,
        desc: '昵称',
      },
      tags: {
        type: 'string',
        required: false,
        desc: '好友标签',
      },
    });
    // 查看该好友是否存在
    const friend = await app.model.Friend.findOne({
      where: {
        user_id: current_user_id,
        friend_id: id,
        isblack: 0,
      },
      include: [
        {
          model: app.model.Tag,
        },
      ],
    });

    if (!friend) {
      ctx.throw(400, '该记录不存在');
    }
    const { tags, nickname } = ctx.request.body;
    // 设置备注
    friend.nickname = nickname;
    await friend.save();

    // 获取当前用户所有标签
    const allTags = await app.model.Tag.findAll({
      where: {
        user_id: current_user_id,
      },
    });

    const allTagsName = allTags.map(item => item.name);

    // 新标签
    let newTags = tags.split(',');

    // 需要添加的标签
    let addTags = newTags.filter(item => !allTagsName.includes(item));

    addTags = addTags.map(name => {
      return {
        name,
        user_id: current_user_id,
      };
    });

    // 写入tag表
    await app.model.Tag.bulkCreate(addTags);

    // 找到新标签的id
    newTags = await app.model.Tag.findAll({
      where: {
        user_id: current_user_id,
        name: newTags,
      },
    });

    const oldTagsIds = friend.tags.map(item => item.id);
    const newTagsIds = newTags.map(item => item.id);

    let addTagIds = newTagsIds.filter(id => !oldTagsIds.includes(id));
    const delTagIds = oldTagsIds.filter(id => !newTagsIds.includes(id));
    // 添加关联关系
    addTagIds = addTagIds.map(tag_id => {
      return {
        tag_id,
        friend_id: friend.id,
      };
    });
    app.model.FriendTag.bulkCreate(addTagIds);

    // 需要删除的关联关系
    app.model.FriendTag.destroy({
      where: {
        tag_id: delTagIds,
        friend_id: friend.id,
      },
    });


    ctx.apiSuccess('ok');
  }

  // 删除好友
  async destroy() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;

    ctx.validate({
      friend_id: {
        type: 'int', required: true, desc: '好友id',
      },
    });
    const { friend_id } = ctx.request.body;
    await app.model.Friend.destroy({
      where: { user_id: current_user_id, friend_id },
    });

    app.model.Friend.destroy({
      where: { user_id: friend_id, friend_id: current_user_id },
    });

    ctx.apiSuccess('ok');
  }
}

module.exports = FriendController;
