// src/components/modern/FinancialHealthCard.jsx
import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateFinancialHealthScore, saveScoreHistory, getScoreHistory } from '../../utils/financialHealthScore';

export default function FinancialHealthCard({ totals, buckets }) {
  const [expanded, setExpanded] = useState(false);

  const healthData = useMemo(() => {
    const result = calculateFinancialHealthScore(totals, buckets);
    
    if (result.overallScore > 0) {
      saveScoreHistory(result.overallScore);
    }
    
    return result;
  }, [totals, buckets]);

  const scoreTrend = useMemo(() => {
    const history = getScoreHistory();
    if (history.length < 2) return null;
    
    const latest = history[history.length - 1].score;
    const previous = history[history.length - 2].score;
    const change = latest - previous;
    
    return {
      change: Math.abs(change),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
      percentage: previous > 0 ? Math.round((change / previous) * 100) : 0
    };
  }, [healthData.overallScore]);

  const { overallScore, status, breakdown, metrics } = healthData;

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Financial Health Score</h3>
          <p className="text-sm text-gray-500">Overall budget performance assessment</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className="flex items-end gap-6 mb-6">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
          </span>
          <span className="text-2xl text-gray-400 font-medium">/ 100</span>
        </div>

        {scoreTrend && (
          <div className={`flex items-center gap-1 mb-2 ${
            scoreTrend.direction === 'up' ? 'text-green-600' : 
            scoreTrend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {scoreTrend.direction === 'up' ? <TrendingUp size={20} /> : 
             scoreTrend.direction === 'down' ? <TrendingDown size={20} /> : null}
            <span className="text-sm font-medium">
              {scoreTrend.direction === 'up' ? '+' : scoreTrend.direction === 'down' ? '-' : ''}
              {scoreTrend.change} pts
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${getBarColor(overallScore)}`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-sm font-medium ${
            status.color === 'green' ? 'text-green-600' : 
            status.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {status.label}
          </span>
          <span className="text-sm text-gray-500">{status.message}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Expense Ratio</div>
          <div className="text-lg font-semibold text-gray-900">
            {Math.round(metrics.expenseRatio * 100)}%
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Savings Rate</div>
          <div className="text-lg font-semibold text-gray-900">
            {Math.round(metrics.savingsRate * 100)}%
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Debt/Income</div>
          <div className="text-lg font-semibold text-gray-900">
            {Math.round(metrics.dtiRatio * 100)}%
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</h4>
          {Object.entries(breakdown).map(([key, item]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">({item.weight}%)</span>
                  <span className={`text-sm font-semibold ${getScoreColor(item.score)}`}>
                    {item.score}/100
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getBarColor(item.score)}`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {healthData.recommendations.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Top Priority: {healthData.recommendations[0].category}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {healthData.recommendations[0].action}
              </p>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                Impact: {healthData.recommendations[0].impact}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}