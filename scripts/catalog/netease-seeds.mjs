import expandedCatalog from "./netease-expanded-seeds.json" with { type: "json" };
import identities from "./netease-identities.json" with { type: "json" };

const seed = (
  slug,
  artist,
  title,
  coreGenres,
  contexts = [],
  albumId = null,
  sourceMarketChannels = [],
  guide = null,
  discoveredAt = "2026-07-23T00:00:00.000Z",
  verification = null,
) => ({
  slug,
  query: { artist, title },
  albumId,
  coreGenres,
  contexts,
  sourceMarketChannels,
  guide,
  discoveredAt,
  verification,
});

const guide = (summaryZh, whyListenZh) => ({
  summaryZh,
  whyListenZh,
  confidence: "curated",
  humanReviewed: true,
});

export const BASE_NETEASE_CATALOG_SEEDS = [
  seed("wake-after-the-rain", "艾志恒Asen", "在雨后醒来", ["hip-hop"], ["夜晚","独处"], "287974232", [], guide("旋律说唱与内省叙事贯穿整张作品，情绪从雨后的迟疑逐渐转向清醒。", "适合在夜晚按曲序完整聆听，留意旋律、人声层次与叙事推进。")),
  seed("super-mr-sun", "SASIOVERLXRD", "超级孙先生", ["hip-hop"], ["夜晚","反复聆听"], "286248593", [], guide("锋利的语言、跳脱结构与地下说唱质感组成一张个性鲜明的长篇作品。", "适合关注押韵、采样与段落切换，在重复聆听中发现细节。")),
  seed("fantasy-jay-chou", "周杰伦", "范特西", ["pop"], ["通勤","周末"], "18915", [], guide("R&B、说唱与华语旋律在多样编曲中保持统一。", "从熟悉旋律进入，留意节拍、人声层次和曲目之间的风格切换。")),
  seed("ye-hui-mei", "周杰伦", "叶惠美", ["pop"], ["通勤","夜晚"]),
  seed("black-tangerine", "陶喆", "黑色柳丁", ["pop"], ["通勤","周末"]),
  seed("the-great-leap", "陶喆", "太平盛世", ["pop"], ["通勤","专注聆听"]),
  seed("fuzao", "王菲", "浮躁", ["experimental-pop"], ["独处","夜晚"], "29748", [], guide("自由的人声与轻盈编曲让整张作品在流行结构之外保持跳脱。", "适合按顺序进入，关注人声、节奏与留白之间不断变化的关系。")),
  seed("fable", "王菲", "寓言", ["pop"], ["夜晚","独处"]),
  seed("u87", "陈奕迅", "U87", ["pop"], ["通勤","夜晚"], "6491"),
  seed("red-leslie", "张国荣", "红", ["pop"], ["夜晚","独处"], "19038"),
  seed("ru-ye", "陈粒", "如也", ["folk"], ["独处","清晨"], "3098832"),
  seed("shan-he-shui", "窦唯", "山河水", ["electronic"], ["专注聆听","夜晚"]),
  seed("black-dream", "窦唯", "黑梦", ["rock"], ["夜晚","独处"], "7608", [], guide("低沉声线、吉他与合成器共同营造幽暗而紧绷的连续气氛。", "适合夜间整张播放，关注节奏与音色如何持续塑造空间。")),
  seed("rock-n-roll-on-the-new-long-march", "崔健", "新长征路上的摇滚", ["rock"], ["通勤","专注聆听"], "6311"),
  seed("omnipotent-youth-society", "万能青年旅店", "万能青年旅店 同名专辑", ["rock"], ["专注聆听","夜晚"]),
  seed("inside-the-cable-temple", "万能青年旅店", "冀西南林路行", ["rock"], ["专注聆听","独处"], "120605500", [], guide("长篇编曲、铜管和器乐呼应把地域经验转化为连续叙事。", "适合留出完整时间，顺着段落转换与器乐主题进入作品。")),
  seed("the-clod", "草东没有派对", "瓦合", ["rock"], ["夜晚","通勤"], "162870766"),
  seed("the-servile", "草东没有派对", "丑奴儿", ["rock"], ["夜晚","独处"]),
  seed("cassa-nova", "落日飛車 Sunset Rollercoaster", "Cassa Nova", ["dream-pop"], ["夜晚","放松"]),
  seed("bathroom", "deca joins", "浴室", ["indie-rock"], ["夜晚","独处"]),
  seed("zero-point-seven", "惘闻", "0.7", ["post-rock"], ["专注聆听","夜晚"]),
  seed("rainbow-mountain", "文雀", "彩虹山", ["post-rock"], ["工作","专注聆听"]),
  seed("the-most-wonderful-journey", "声音玩具", "最美妙的旅行", ["rock"], ["专注聆听","通勤"]),
  seed("jelly-empire", "木马", "果冻帝国", ["rock"], ["夜晚","独处"]),
  seed("arthropods", "33EMYBW", "Arthropods", ["electronic"], ["专注聆听","工作"]),
  seed("birdy-island-remixes", "Howie Lee", "鸟岛(Remixes)", ["electronic"], ["夜晚","专注聆听"], "135678901"),
  seed("entertainment-world", "林强", "娱乐世界", ["electronic"], ["夜晚","通勤"]),
  seed("temple-fair-tour", "左小祖咒", "庙会之旅", ["experimental-rock"], ["专注聆听","独处"]),
  seed("jims-restaurant", "赵雷", "吉姆餐厅", ["folk"], ["夜晚","独处"]),
  seed("everything-is-not-as-bad", "万晓利", "这一切没有想象的那么糟", ["folk"], ["独处","清晨"]),
  seed("virtuous", "苏阳", "贤良", ["folk"], ["通勤","周末"]),
  seed("black-cab", "Higher Brothers", "Black Cab", ["hip-hop"], ["通勤","运动"]),
  seed("dark-horse", "马思唯", "黑马", ["hip-hop"], ["通勤","运动"]),
  seed("science-fiction", "法老", "科幻小说", ["hip-hop"], ["专注聆听","夜晚"]),
  seed("key-to-l", "KEY.L刘聪", "KEY to L", ["hip-hop"], ["通勤","夜晚"]),
  seed("air-plan", "艾热 AIR", "AIR PLAN", ["hip-hop"], ["通勤","周末"]),
  seed("song-of-the-mountain", "刀郎", "山歌寥哉", ["folk"], ["专注聆听","周末"], "169512732"),
  seed("window-side-wish", "吴宇深", "窗边盼望", [], [], "386884453", ["ALL","ZH"]),
  seed("wind-on-the-mountain", "巴扎黑", "吹吹山顶的风", [], [], "387217523", ["ALL","ZH"]),
  seed("that-glance", "王赛罕娜", "那一眼", [], [], "386378826", ["ALL","ZH"]),
  seed("poem-to-the-heartless", "云汐", "诗敬薄情人", [], [], "386877428", ["ZH"]),
  seed("graduating-from-a-chapter", "阿力普", "毕业生 GRADUATING FROM A CHAPTER OF LIFE", [], [], "386849800", ["ZH"]),
  seed("topic-six-decennium", "体熊专科", "Topic 6: 拾 Decennium", [], [], "384653629", ["ZH"]),
  seed("upward-spiral", "KKECHO", "Upward Spiral (扶瑶直上)", ["hip-hop"], ["运动"], "386632533", ["ZH"]),
  seed("from-sand-to-wave", "Mikann耙耙柑", "从沙至浪", ["hip-hop"], ["通勤"], "387010610", ["ZH"]),
  seed("mysterious-path", "拗拗 NeoNew", "Mysterious Path", ["electronic"], ["夜晚"], "386815599", ["ZH"]),
  seed("rumours", "Fleetwood Mac", "Rumours", ["rock"], ["通勤","周末"], "1637054"),
  seed("blue-joni-mitchell", "Joni Mitchell", "Blue", ["folk"], ["独处","夜晚"], "1724200"),
  seed("beyonce", "Beyoncé", "BEYONCÉ", ["pop"], ["夜晚","运动"], "2732013"),
  seed("hit-me-hard-and-soft", "Billie Eilish", "HIT ME HARD AND SOFT", ["pop"], ["夜晚","独处"], "195498828"),
  seed("first-love", "宇多田ヒカル", "First Love", ["pop"], ["夜晚","通勤"], "2093862"),
  seed("12-ryuichi-sakamoto", "坂本龍一", "12", ["ambient"], ["专注聆听","独处"], "158396696"),
  seed("map-of-the-soul-7", "BTS (防弹少年团)", "MAP OF THE SOUL : 7", ["pop"], ["运动","通勤"], "85783683"),
  seed("palette-iu", "IU", "Palette", ["pop"], ["通勤","周末"], "35377328"),
  seed("ok-computer", "Radiohead", "OK Computer", ["alternative-rock"], ["专注聆听","夜晚"]),
  seed("hounds-of-love", "Kate Bush", "Hounds of Love", ["art-pop"], ["专注聆听","夜晚"]),
  seed("loveless", "My Bloody Valentine", "Loveless", ["dream-pop"], ["夜晚","专注聆听"]),
  seed("souvlaki", "Slowdive", "Souvlaki", ["dream-pop"], ["夜晚","独处"]),
  seed("to-pimp-a-butterfly", "Kendrick Lamar", "To Pimp a Butterfly", ["hip-hop"], ["专注聆听","阅读歌词"]),
  seed("madvillainy", "Madvillain", "Madvillainy", ["hip-hop"], ["通勤","反复聆听"]),
  seed("discovery-daft-punk", "Daft Punk", "Discovery", ["electronic"], ["运动","通勤"]),
  seed("untrue", "Burial", "Untrue", ["electronic"], ["夜晚","独处"]),
  seed("kind-of-blue", "Miles Davis", "Kind of Blue", ["jazz"], ["晚餐","专注聆听"]),
  seed("a-love-supreme", "John Coltrane", "A Love Supreme", ["jazz"], ["专注聆听","独处"]),
  seed("heaven-or-las-vegas", "Cocteau Twins", "Heaven or Las Vegas", ["dream-pop"], ["夜晚","放松"]),
  seed("agaetis-byrjun", "Sigur Rós", "Ágætis byrjun", ["post-rock"], ["专注聆听","放松"]),
  seed("lift-your-skinny-fists", "Godspeed You! Black Emperor", "Lift Your Skinny Fists Like Antennas to Heaven", ["post-rock"], ["专注聆听","深夜"]),
  seed("master-of-puppets", "Metallica", "Master of Puppets", ["metal"], ["运动","专注聆听"]),
];

const excludedBaseAlbumIds = new Set(["386632533", "39491272"]);
const publishableBaseSeeds = BASE_NETEASE_CATALOG_SEEDS.filter((item) =>
  item.coreGenres.length > 0 && !excludedBaseAlbumIds.has(String(item.albumId ?? identities[item.slug]?.albumId)),
);
const existingAlbumIds = new Set(
  publishableBaseSeeds
    .map((item) => item.albumId ?? identities[item.slug]?.albumId)
    .filter(Boolean)
    .map(String),
);
const expandedSeeds = expandedCatalog.records
  .filter((item) => !existingAlbumIds.has(String(item.albumId)))
  .slice(0, 260)
  .map((item) => seed(
    item.slug,
    item.artistName,
    item.albumTitle,
    item.coreGenres,
    item.contexts,
    item.albumId,
    [],
    null,
    item.discoveredAt,
    {
      method: item.verificationMethod,
      artistId: item.artistId,
      expectedReleaseYear: item.expectedReleaseYear,
      expectedAlbumType: item.expectedAlbumType,
      expectedTrackCount: item.expectedTrackCount,
    },
  ));

export const NETEASE_CATALOG_SEEDS = [...publishableBaseSeeds, ...expandedSeeds];

export const REQUIRED_NETEASE_SAMPLES = [
  {
    "albumId": "287974232",
    "title": "在雨后醒来",
    "artist": "艾志恒Asen"
  },
  {
    "albumId": "286248593",
    "title": "超级孙先生",
    "artist": "SASIOVERLXRD"
  }
];
