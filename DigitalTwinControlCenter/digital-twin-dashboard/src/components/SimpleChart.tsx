"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface SimpleChartProps {
  title: string;
  data: DataPoint[];
  type: 'bar' | 'line' | 'pie';
  height?: number;
  showValues?: boolean;
  unit?: string;
}

export function SimpleChart({ title, data, type, height = 200, showValues = true, unit = '' }: SimpleChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  const renderBarChart = () => (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">{item.label}</span>
            {showValues && (
              <Badge variant="outline" className="text-xs">
                {item.value}{unit}
              </Badge>
            )}
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                item.color || colors[index % colors.length]
              }`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderLineChart = () => (
    <div className="relative" style={{ height }}>
      <svg width="100%" height="100%" className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line
            key={y}
            x1="0"
            y1={`${y}%`}
            x2="100%"
            y2={`${y}%`}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
        ))}
        
        {/* Line path */}
        <polyline
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
          points={data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - (item.value / maxValue) * 100;
            return `${x},${y}`;
          }).join(' ')}
        />
        
        {/* Data points */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 100 - (item.value / maxValue) * 100;
          return (
            <circle
              key={index}
              cx={`${x}%`}
              cy={`${y}%`}
              r="4"
              fill="rgb(59, 130, 246)"
              className="hover:r-6 transition-all"
            />
          );
        })}
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        {data.map((item, index) => (
          <span key={index} className="truncate max-w-16">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );

  const renderPieChart = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;
    
    return (
      <div className="flex items-center space-x-6">
        <div className="relative" style={{ width: height, height }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              
              currentAngle += angle;
              
              const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
              const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
              const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
              const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              
              return (
                <path
                  key={index}
                  d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                  fill={`hsl(${(index * 360) / data.length}, 70%, 50%)`}
                  className="hover:opacity-80 transition-opacity"
                />
              );
            })}
          </svg>
        </div>
        
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: `hsl(${(index * 360) / data.length}, 70%, 50%)` }}
              />
              <span className="text-sm font-medium">{item.label}</span>
              {showValues && (
                <Badge variant="outline" className="text-xs">
                  {item.value}{unit}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {type === 'bar' && renderBarChart()}
        {type === 'line' && renderLineChart()}
        {type === 'pie' && renderPieChart()}
      </CardContent>
    </Card>
  );
}
