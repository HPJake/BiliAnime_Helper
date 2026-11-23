/** 弹窗标题下方的本地文库；长台词的展示与轮换逻辑另行处理。 */
export const HEADER_PHRASE_CATEGORIES = [
  "问候",
  "经典台词",
  "二次元梗",
  "弹幕"
] as const;

export type HeaderPhraseCategory = typeof HEADER_PHRASE_CATEGORIES[number];

export type HeaderPhrase = Readonly<{
  text: string;
  category: HeaderPhraseCategory;
}>;

export const HEADER_PHRASES: readonly HeaderPhrase[] = [
  { text: "Ciallo～(∠・ω )⌒☆", category: "问候" },
  { text: "乾杯- ( ゜- ゜)つロ", category: "问候" },
  { text: "主人，欢迎回来，今天看什么？", category: "问候" },
  { text: "一起打开新一集吧", category: "问候" },

  { text: "「真相只有一个！」", category: "经典台词" },
  { text: "「教练，我想打篮球」", category: "经典台词" },
  { text: "「我要成为海贼王！」", category: "经典台词" },
  { text: "「燃起来了！」", category: "经典台词" },
  { text: "「为什么要演奏春日影！」", category: "经典台词" },
  { text: "「我是来结束这个乐队的」", category: "经典台词" },
  { text: "「你这个人满脑子都是自己呢」", category: "经典台词" },
  { text: "「我们每天度过的称之为日常的生活，其实是一个个奇迹的连续也说不定。」", category: "经典台词" },
  { text: "「我们终会相知，在那悠远的苍穹。」", category: "经典台词" },
  { text: "「马上，春天就要来了，与你相遇的春天，一个没有你的春天」", category: "经典台词" },
  { text: "「能哭的地方，只有厕所，和爸爸的怀里」", category: "经典台词" },
  { text: "「谁都无法相信未来，谁都无法接受未来。」", category: "经典台词" },
  { text: "「隐约雷鸣，阴霾天空，但盼风雨来，能留你在此。」", category: "经典台词" },
  { text: "「隐约雷鸣，阴霾天空，即使天无雨，我亦留此地。」", category: "经典台词" },
  { text: "「重要的人，不能忘記的人，不想忘記的人。你，是誰？」", category: "经典台词" },
  { text: "「下辈子请让我做个东京的帅哥吧！」", category: "经典台词" },
  { text: "「呐，现在开始要放晴了哦。」", category: "经典台词" },
  { text: "「天气什么的就让它这样混乱下去吧！」", category: "经典台词" },
  { text: "「相比于蓝天，我更想选择阳菜。」", category: "经典台词" },
  { text: "「面麻最喜欢仁太了…对仁太的喜欢…是想成为仁太新娘的那种喜欢~」", category: "经典台词" },
  { text: "「1000 减 7 等于多少？」", category: "经典台词" },
  { text: "「总有一天我会让这里座无虚席!」", category: "经典台词" },
  { text: "「大家的背后，由我来守护！」", category: "经典台词" },
  { text: "「没有未来的未来不是我想要的未来！」", category: "经典台词" },
  { text: "「男人变态有什么错！」", category: "经典台词" },
  { text: "「不能逃避，不能逃避，不能逃避。」", category: "经典台词" },
  { text: "「错的不是我，而是这个世界。」", category: "经典台词" },
  { text: "「亚丝娜，我的命是你的」", category: "经典台词" },
  { text: "「林肯死大头！」", category: "经典台词" },
  { text: "「秒速 5 厘米，那是樱花飘落的速度」", category: "经典台词" },
  { text: "「一切都是 Steins Gate 的选择！」", category: "经典台词" },
  { text: "「没必要的事不做，必要的事尽快做。」", category: "经典台词" },
  { text: "「人类的赞歌就是勇气的赞歌」", category: "经典台词" },
  { text: "「老实赚钱很枯燥吧」", category: "经典台词" },
  { text: "「3301!」", category: "经典台词" },
  { text: "「小哥，买苹果吗？」", category: "经典台词" },
  { text: "「今后也让我们好好认识吧，波奇酱你的摇滚，“孤独摇滚”！」", category: "经典台词" },

  { text: "电脑配件已到货", category: "二次元梗" },
  { text: "异世界传送中……", category: "二次元梗" },
  { text: "追番进度 +1", category: "二次元梗" },
  { text: "本集经费在燃烧", category: "二次元梗" },
  { text: "这波安利我吃了", category: "二次元梗" },
  { text: "再看一集就睡，真的", category: "二次元梗" },

  { text: "前方高能！", category: "弹幕" },
  { text: "弹幕护体", category: "弹幕" },
  { text: "爷青回", category: "弹幕" },
  { text: "awsl", category: "弹幕" },
  { text: "下次一定", category: "弹幕" },
  { text: "完结撒花！", category: "弹幕" },
  { text: "空降成功", category: "弹幕" },

] as const;
