import type { Txn } from '../parse/types';

export type Cat =
  | '外卖'
  | '餐饮'
  | '奶茶咖啡'
  | '交通'
  | '购物'
  | '房租'
  | '游戏娱乐'
  | '转账红包'
  | '日用'
  | '其他';

const RULES: { cat: Cat; keys: string[] }[] = [
  { cat: '外卖', keys: ['美团', '饿了么', '饿了吗', '外卖', '蜂鸟'] },
  { cat: '奶茶咖啡', keys: ['瑞幸', '喜茶', '奈雪', '星巴克', '咖啡', '奶茶', '茶颜', '霸王茶姬', '蜜雪'] },
  { cat: '交通', keys: ['滴滴', '高德', '打车', '地铁', '公交', '铁路', '12306', '曹操', '花小猪', '停车'] },
  { cat: '房租', keys: ['房租', '租房', '房东', '贝壳', '自如', '公寓'] },
  { cat: '游戏娱乐', keys: ['steam', '游戏', '网易', '腾讯游戏', '电影', '票务', '演唱会', 'bilibili', '爱奇艺', '腾讯视频'] },
  { cat: '购物', keys: ['淘宝', '天猫', '京东', '拼多多', '唯品会', '得物', '闲鱼'] },
  { cat: '日用', keys: ['盒马', '超市', '便利店', '永辉', '物美', '日用', '药店'] },
  { cat: '餐饮', keys: ['肯德基', '麦当劳', '必胜客', '餐饮', '美食', '火锅', '烧烤'] },
  { cat: '转账红包', keys: ['转账', '红包', '微信红包', '群收款'] },
];

export function categorize(t: Txn): Cat {
  const blob = `${t.counterparty} ${t.product} ${t.typeOrCategory}`.toLowerCase();
  // wechat transfer type
  if (/转账|红包|群收款/.test(t.typeOrCategory)) return '转账红包';
  for (const r of RULES) {
    if (r.keys.some((k) => blob.includes(k.toLowerCase()))) return r.cat;
  }
  if (/餐饮|美食/.test(t.typeOrCategory)) return '餐饮';
  if (/交通/.test(t.typeOrCategory)) return '交通';
  return '其他';
}
