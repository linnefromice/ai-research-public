/**
 * 日本語 TTS 読み方補正辞書。
 *
 * Web Speech API の日本語 voice は英字略語を「アルファベット」単位で読みがちで、
 * "AI" を「エーアイ」ではなく「アイ」、"LLM" を「エルエルエム」ではなく
 * 「エル・エル・エム」と読まれることがある。ここでカタカナに置換しておくと
 * どの voice でも一貫した読み方になる。
 *
 * 対応範囲: ここは "単語レベル" の補正。英文 (文レベル) は tts-segment.ts で
 * 英語 voice に切り替えるため、ここでは扱わない。
 *
 * Design: docs/plans/2026-04-23-tts-phase2-improvements-design.md
 */

interface DictEntry {
  /** Match target (boundary-aware regex) */
  pattern: RegExp;
  /** Katakana replacement */
  replacement: string;
}

/**
 * テック/金融/略語の読み方辞書。
 * 順序重要: 長い match を先に試す (e.g., "CI/CD" before "CI").
 * パターンは `\b` で boundary を明示、replacement は katakana。
 */
export const TECH_READING_DICT: DictEntry[] = [
  // AI / ML 系
  { pattern: /\bAI\b/g, replacement: 'エーアイ' },
  { pattern: /\bML\b/g, replacement: 'エムエル' },
  { pattern: /\bLLM\b/g, replacement: 'エルエルエム' },
  { pattern: /\bNLP\b/g, replacement: 'エヌエルピー' },
  { pattern: /\bGPT\b/g, replacement: 'ジーピーティー' },
  { pattern: /\bRAG\b/g, replacement: 'ラグ' },
  { pattern: /\bMCP\b/g, replacement: 'エムシーピー' },

  // Dev 系 (長 match 優先)
  { pattern: /\bCI\/CD\b/g, replacement: 'シーアイ・シーディー' },
  { pattern: /\bCI\b/g, replacement: 'シーアイ' },
  { pattern: /\bCD\b/g, replacement: 'シーディー' },
  { pattern: /\bAPI\b/g, replacement: 'エーピーアイ' },
  { pattern: /\bCLI\b/g, replacement: 'シーエルアイ' },
  { pattern: /\bGUI\b/g, replacement: 'ジーユーアイ' },
  { pattern: /\bIDE\b/g, replacement: 'アイディーイー' },
  { pattern: /\bSDK\b/g, replacement: 'エスディーケー' },
  { pattern: /\bSaaS\b/gi, replacement: 'サース' },
  { pattern: /\bPaaS\b/gi, replacement: 'パース' },
  { pattern: /\bIaaS\b/gi, replacement: 'アイアース' },
  { pattern: /\bOSS\b/g, replacement: 'オーエスエス' },
  { pattern: /\bOS\b/g, replacement: 'オーエス' },
  { pattern: /\bUI\b/g, replacement: 'ユーアイ' },
  { pattern: /\bUX\b/g, replacement: 'ユーエックス' },
  { pattern: /\bDB\b/g, replacement: 'ディービー' },
  { pattern: /\bSQL\b/g, replacement: 'エスキューエル' },
  { pattern: /\bJSON\b/g, replacement: 'ジェイソン' },
  { pattern: /\bYAML\b/g, replacement: 'ヤメル' },
  { pattern: /\bHTML\b/g, replacement: 'エイチティーエムエル' },
  { pattern: /\bCSS\b/g, replacement: 'シーエスエス' },
  { pattern: /\bJS\b/g, replacement: 'ジェイエス' },
  { pattern: /\bTS\b/g, replacement: 'ティーエス' },
  { pattern: /\bPR\b/g, replacement: 'ピーアール' },
  { pattern: /\bURL\b/g, replacement: 'ユーアールエル' },
  { pattern: /\bURI\b/g, replacement: 'ユーアールアイ' },
  { pattern: /\bHTTP\b/g, replacement: 'エイチティーティーピー' },
  { pattern: /\bHTTPS\b/g, replacement: 'エイチティーティーピーエス' },

  // Cloud / Infra
  { pattern: /\bGPU\b/g, replacement: 'ジーピーユー' },
  { pattern: /\bCPU\b/g, replacement: 'シーピーユー' },
  { pattern: /\bRAM\b/g, replacement: 'ラム' },
  { pattern: /\bSSD\b/g, replacement: 'エスエスディー' },
  { pattern: /\bAWS\b/g, replacement: 'エーダブリューエス' },
  { pattern: /\bGCP\b/g, replacement: 'ジーシーピー' },
  { pattern: /\bS3\b/g, replacement: 'エススリー' },
  { pattern: /\bEC2\b/g, replacement: 'イーシーツー' },
  { pattern: /\bIAM\b/g, replacement: 'アイアム' },
  { pattern: /\bVPC\b/g, replacement: 'ブイピーシー' },
  { pattern: /\bCDN\b/g, replacement: 'シーディーエヌ' },
  { pattern: /\bDNS\b/g, replacement: 'ディーエヌエス' },
  { pattern: /\bSSH\b/g, replacement: 'エスエスエイチ' },
  { pattern: /\bTLS\b/g, replacement: 'ティーエルエス' },
  { pattern: /\bSSL\b/g, replacement: 'エスエスエル' },

  // Auth / Security
  { pattern: /\bOAuth\b/gi, replacement: 'オーオース' },
  { pattern: /\bJWT\b/g, replacement: 'ジェイダブリューティー' },
  { pattern: /\bSSO\b/g, replacement: 'エスエスオー' },
  { pattern: /\bMFA\b/g, replacement: 'エムエフエー' },
  { pattern: /\b2FA\b/g, replacement: 'ツーエフエー' },
  { pattern: /\bWAF\b/g, replacement: 'ワフ' },
  { pattern: /\bCSRF\b/g, replacement: 'シーエスアールエフ' },
  { pattern: /\bXSS\b/g, replacement: 'エックスエスエス' },

  // ソフト
  { pattern: /\bMVP\b/g, replacement: 'エムブイピー' },
  { pattern: /\bB2B\b/g, replacement: 'ビーツービー' },
  { pattern: /\bB2C\b/g, replacement: 'ビーツーシー' },
  { pattern: /\bSNS\b/g, replacement: 'エスエヌエス' },
  { pattern: /\bTV\b/g, replacement: 'ティーブイ' },
  { pattern: /\bCEO\b/g, replacement: 'シーイーオー' },
  { pattern: /\bCTO\b/g, replacement: 'シーティーオー' },
  { pattern: /\bCOO\b/g, replacement: 'シーオーオー' },
  { pattern: /\bCFO\b/g, replacement: 'シーエフオー' },
  { pattern: /\bKPI\b/g, replacement: 'ケーピーアイ' },
  { pattern: /\bOKR\b/g, replacement: 'オーケーアール' },

  // 金融
  { pattern: /\bFX\b/g, replacement: 'エフエックス' },
  { pattern: /\bETF\b/g, replacement: 'イーティーエフ' },
  { pattern: /\bREIT\b/g, replacement: 'リート' },
  { pattern: /\bIPO\b/g, replacement: 'アイピーオー' },
  { pattern: /\bM&A\b/g, replacement: 'エムアンドエー' },
  { pattern: /\bESG\b/g, replacement: 'イーエスジー' },
  { pattern: /\bGDP\b/g, replacement: 'ジーディーピー' },
  { pattern: /\bFRB\b/g, replacement: 'エフアールビー' },
  { pattern: /\bECB\b/g, replacement: 'イーシービー' },
  { pattern: /\bBOJ\b/g, replacement: 'ボージェー' },
  { pattern: /\bFOMC\b/g, replacement: 'エフオーエムシー' },
  { pattern: /\bCPI\b/g, replacement: 'シーピーアイ' },
  { pattern: /\bPPI\b/g, replacement: 'ピーピーアイ' },
  { pattern: /\bPBR\b/g, replacement: 'ピービーアール' },
  { pattern: /\bPER\b/g, replacement: 'ピーイーアール' },
  { pattern: /\bROE\b/g, replacement: 'アールオーイー' },
  { pattern: /\bROI\b/g, replacement: 'アールオーアイ' },
  { pattern: /\bS&P\b/g, replacement: 'エスアンドピー' },
  { pattern: /\bNY\b/g, replacement: 'ニューヨーク' },

  // その他よく出る
  { pattern: /\bQ&A\b/g, replacement: 'キューアンドエー' },
  { pattern: /\bFAQ\b/g, replacement: 'エフエーキュー' },
  { pattern: /\bPDF\b/g, replacement: 'ピーディーエフ' },
  { pattern: /\bCSV\b/g, replacement: 'シーエスブイ' },
  { pattern: /\bXML\b/g, replacement: 'エックスエムエル' },
  { pattern: /\bRSS\b/g, replacement: 'アールエスエス' },
  { pattern: /\bVPN\b/g, replacement: 'ブイピーエヌ' },
  { pattern: /\bIoT\b/g, replacement: 'アイオーティー' },
  { pattern: /\bAR\b/g, replacement: 'エーアール' },
  { pattern: /\bVR\b/g, replacement: 'ブイアール' },
  { pattern: /\bXR\b/g, replacement: 'エックスアール' },
  { pattern: /\bNFT\b/g, replacement: 'エヌエフティー' },
  { pattern: /\bDeFi\b/gi, replacement: 'ディーファイ' },
  { pattern: /\bWeb3\b/gi, replacement: 'ウェブスリー' },
];

/**
 * Apply the reading dictionary to a text. Only meaningful for ja-JP input.
 * Should be called before chunking.
 */
export function applyReadingDict(text: string): string {
  let out = text;
  for (const { pattern, replacement } of TECH_READING_DICT) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
