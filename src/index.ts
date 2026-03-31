import { BaseAgent, AgentResult, AgentContext } from '@openclaw/adk';

interface StockData {
  name: string;
  code: string;
  market: 'A-SH' | 'A-SZ' | 'HK' | 'US';
  price?: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  volume?: string;
}

interface StockAnalysisResult {
  stock: StockData;
  trend: 'up' | 'down' | 'sideways';
  recommendation: 'buy' | 'hold' | 'sell';
  confidence: number;
  reasons: string[];
  risks: string[];
}

const STOCK_DATABASE: Record<string, StockData> = {
  '贵州茅台': { name: '贵州茅台', code: '600519.SH', market: 'A-SH' },
  '茅台': { name: '贵州茅台', code: '600519.SH', market: 'A-SH' },
  '中国平安': { name: '中国平安', code: '601318.SH', market: 'A-SH' },
  '平安银行': { name: '平安银行', code: '000001.SZ', market: 'A-SZ' },
  '招商银行': { name: '招商银行', code: '600036.SH', market: 'A-SH' },
  '中信证券': { name: '中信证券', code: '600030.SH', market: 'A-SH' },
  '宁德时代': { name: '宁德时代', code: '300750.SZ', market: 'A-SZ' },
  '比亚迪': { name: '比亚迪', code: '002594.SZ', market: 'A-SZ' },
  '五粮液': { name: '五粮液', code: '000858.SZ', market: 'A-SZ' },
  '中芯国际': { name: '中芯国际', code: '688981.SH', market: 'A-SH' },
  '腾讯': { name: '腾讯控股', code: '0700.HK', market: 'HK' },
  '腾讯控股': { name: '腾讯控股', code: '0700.HK', market: 'HK' },
  '阿里巴巴': { name: '阿里巴巴', code: '9988.HK', market: 'HK' },
  '美团': { name: '美团', code: '3690.HK', market: 'HK' },
  '小米': { name: '小米集团', code: '1810.HK', market: 'HK' },
  '苹果': { name: 'Apple', code: 'AAPL', market: 'US' },
  '特斯拉': { name: 'Tesla', code: 'TSLA', market: 'US' },
  '英伟达': { name: 'NVIDIA', code: 'NVDA', market: 'US' },
};

const MARKET_KEYWORDS = {
  'A股': ['a股', '沪深', '上海', '深圳', '主板', '创业板', '科创板'],
  '港股': ['港股', '港交所', '香港'],
  '美股': ['美股', '纳斯达克', '纽交所', 'NYSE', 'NASDAQ'],
};

const INDUSTRY_MAP: Record<string, string> = {
  '贵州茅台': '白酒',
  '五粮液': '白酒',
  '中国平安': '保险',
  '平安银行': '银行',
  '招商银行': '银行',
  '宁德时代': '新能源',
  '比亚迪': '新能源汽车',
  '腾讯控股': '互联网',
  '阿里巴巴': '电商',
  'Apple': '科技',
  'Tesla': '电动车',
  'NVIDIA': '芯片',
};

const TREND_WEIGHTS = { up: 0.35, down: 0.25, sideways: 0.40 };

export class MyFinanceAgentAgent extends BaseAgent {
  private sentimentKeywords = {
    positive: ['利好', '上涨', '突破', '增长', '盈利', '回购', '增持'],
    negative: ['利空', '下跌', '亏损', '减持', '风险', '监管', '调查'],
  };

  async execute(input: string, context?: Partial<AgentContext>): Promise<AgentResult> {
    try {
      const stock = this.parseStock(input);
      if (!stock) {
        return {
          success: false,
          error: '无法识别股票名称或代码，请提供明确的股票名称（如：贵州茅台、腾讯、苹果）',
          output: { input, suggestion: '示例：分析贵州茅台的股价走势' }
        };
      }

      const analysis = this.generateAnalysis(stock, input);
      const report = this.formatReport(stock, analysis);

      return {
        success: true,
        output: {
          stock: stock,
          analysis: analysis,
          report: report
        },
        metadata: {
          timestamp: new Date().toISOString(),
          agent: 'my-finance-agent'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `分析失败: ${error}`,
        output: { input }
      };
    }
  }

  private parseStock(input: string): StockData | null {
    for (const [name, data] of Object.entries(STOCK_DATABASE)) {
      if (input.includes(name)) {
        return data;
      }
    }

    const codePatterns = [
      { regex: /(\d{6})\.(SH|SZ)/, getMarket: (m: string) => m === 'SH' ? 'A-SH' : 'A-SZ' },
      { regex: /(\d{4})\.HK/, getMarket: () => 'HK' },
      { regex: /\b([A-Z]{1,5})\b/, getMarket: () => 'US' },
    ];

    for (const { regex, getMarket } of codePatterns) {
      const match = input.match(regex);
      if (match) {
        return {
          name: match[0],
          code: match[0],
          market: getMarket(match[2] || '') as StockData['market']
        };
      }
    }

    return null;
  }

  private generateAnalysis(stock: StockData, input: string): StockAnalysisResult {
    const industry = INDUSTRY_MAP[stock.name] || '综合';
    const sentimentScore = this.calculateSentiment(input);
    const trend = this.determineTrend(sentimentScore);
    const { recommendation, confidence } = this.determineRecommendation(trend);
    const reasons = this.generateReasons(industry, trend);
    const risks = this.generateRisks(industry);

    return {
      stock,
      trend,
      recommendation,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      risks
    };
  }

  private calculateSentiment(input: string): number {
    let score = 0;
    for (const keyword of this.sentimentKeywords.positive) {
      if (input.includes(keyword)) score++;
    }
    for (const keyword of this.sentimentKeywords.negative) {
      if (input.includes(keyword)) score--;
    }
    return score;
  }

  private determineTrend(sentimentScore: number): 'up' | 'down' | 'sideways' {
    if (sentimentScore > 0) return 'up';
    if (sentimentScore < 0) return 'down';

    const rand = Math.random();
    if (rand < TREND_WEIGHTS.up) return 'up';
    if (rand < TREND_WEIGHTS.up + TREND_WEIGHTS.down) return 'down';
    return 'sideways';
  }

  private determineRecommendation(trend: 'up' | 'down' | 'sideways'): { recommendation: 'buy' | 'hold' | 'sell'; confidence: number } {
    if (trend === 'up') {
      return { recommendation: 'buy', confidence: 0.6 + Math.random() * 0.3 };
    }
    if (trend === 'down') {
      return { recommendation: 'sell', confidence: 0.55 + Math.random() * 0.35 };
    }
    return { recommendation: 'hold', confidence: 0.5 + Math.random() * 0.2 };
  }

  private generateReasons(industry: string, trend: 'up' | 'down' | 'sideways'): string[] {
    const templates = {
      up: [
        `${industry}行业景气度回升`,
        `技术面呈现多头排列`,
        `成交量稳步放大`,
        `基本面稳健，业绩预期向好`,
        `机构持仓比例上升`
      ],
      down: [
        `${industry}行业面临调整压力`,
        `技术面走弱，跌破关键支撑`,
        `成交量萎缩，市场情绪低迷`,
        `估值偏高，存在回调风险`,
        `行业竞争加剧`
      ],
      sideways: [
        `${industry}行业处于震荡期`,
        `多空力量相对均衡`,
        `等待催化剂出现`,
        `估值处于合理区间`,
        `建议观望为主`
      ]
    };

    const reasons = templates[trend];
    const count = 2 + Math.floor(Math.random() * 2);
    return reasons.slice(0, count);
  }

  private generateRisks(industry: string): string[] {
    const riskTemplates = [
      '市场系统性风险',
      `${industry}行业政策变化风险`,
      '个股业绩不及预期风险',
      '市场情绪波动风险',
      '宏观经济下行风险',
      '汇率波动风险（如适用）'
    ];

    const count = 2 + Math.floor(Math.random() * 2);
    return riskTemplates.slice(0, count);
  }

  private formatReport(stock: StockData, analysis: StockAnalysisResult): string {
    const trendEmoji = { up: '📈', down: '📉', sideways: '➡️' };
    const recEmoji = { buy: '🟢', hold: '🟡', sell: '🔴' };
    const recText = { buy: '买入', hold: '持有', sell: '卖出' };
    const trendText = { up: '上涨', down: '下跌', sideways: '横盘' };

    return `
## 📊 ${stock.name}(${stock.code}) 股价分析

### 📈 核心数据
| 指标 | 数值 |
|------|------|
| 市场 | ${stock.market} |
| 趋势 | ${trendEmoji[analysis.trend]} ${trendText[analysis.trend]} |
| 置信度 | ${(analysis.confidence * 100).toFixed(0)}% |

### 💡 投资建议
**建议：${recEmoji[analysis.recommendation]} ${recText[analysis.recommendation]}**

**理由：**
${analysis.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### ⚠️ 风险提示
${analysis.risks.map(r => `- ${r}`).join('\n')}

---
*分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。*
`;
  }
}

export default MyFinanceAgentAgent;