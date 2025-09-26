// src/components/modern/HealthRecommendations.jsx
import { AlertTriangle, CheckCircle, TrendingUp, Info } from 'lucide-react';
import { calculateFinancialHealthScore } from '../../utils/financialHealthScore';

export default function HealthRecommendations({ totals, buckets }) {
  const healthData = calculateFinancialHealthScore(totals, buckets);
  const { recommendations, categoryBreakdown } = healthData;

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="text-red-500" size={20} />;
      case 'medium':
        return <Info className="text-yellow-500" size={20} />;
      case 'low':
        return <TrendingUp className="text-blue-500" size={20} />;
      default:
        return <CheckCircle className="text-green-500" size={20} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Personalized Recommendations
        </h3>
        <p className="text-sm text-gray-500">
          Automated suggestions to improve your financial health score
        </p>
      </div>

      {recommendations.length > 0 ? (
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}
            >
              <div className="flex items-start gap-3">
                {getPriorityIcon(rec.priority)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{rec.category}</h4>
                    {getPriorityBadge(rec.priority)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Issue:</span> {rec.issue}
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Action:</span> {rec.action}
                    </div>
                    <div className="text-sm font-medium text-blue-600">
                      ⚡ {rec.impact}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            Excellent Financial Health!
          </h4>
          <p className="text-sm text-gray-500">
            No critical issues detected. Keep up the great work!
          </p>
        </div>
      )}

      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Category Performance</h4>
          <div className="space-y-3">
            {Object.entries(categoryBreakdown).map(([category, data]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {data.percentage}% of income
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    Target: {data.recommended}
                  </span>
                  {data.status === 'optimal' && (
                    <CheckCircle className="text-green-500" size={16} />
                  )}
                  {data.status === 'over' && (
                    <AlertTriangle className="text-yellow-500" size={16} />
                  )}
                  {data.status === 'under' && (
                    <CheckCircle className="text-blue-500" size={16} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-3">Quick Tips</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-blue-500">•</span>
            <span>Review your budget weekly to stay on track</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-blue-500">•</span>
            <span>Automate savings to hit your 15% target</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-blue-500">•</span>
            <span>Build emergency fund to 3-6 months expenses</span>
          </div>
        </div>
      </div>
    </div>
  );
}