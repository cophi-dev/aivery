'use client';

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle } from "lucide-react";

type MuscleGroupStat = {
  group: string;
  frequency: number;
  neglected: boolean;
};

interface MuscleGroupInsightsProps {
  muscleGroups: MuscleGroupStat[];
  compact?: boolean;
}

export default function MuscleGroupInsights({ 
  muscleGroups, 
  compact = false 
}: MuscleGroupInsightsProps) {
  // Find the max frequency to normalize progress bars
  const maxFrequency = Math.max(...muscleGroups.map(mg => mg.frequency), 1);
  
  // Function to capitalize first letter of each word
  const capitalize = (str: string) => {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Group muscle groups into categories
  const muscleGroups_UpperBodyPush = muscleGroups.filter(mg => 
    ['chest', 'shoulders', 'triceps'].includes(mg.group)
  );
  
  const muscleGroups_UpperBodyPull = muscleGroups.filter(mg => 
    ['back', 'biceps', 'forearms', 'traps', 'lats', 'rhomboids', 'trapezius'].includes(mg.group)
  );
  
  const muscleGroups_Core = muscleGroups.filter(mg => 
    ['core', 'abs', 'abdominals', 'obliques'].includes(mg.group)
  );
  
  const muscleGroups_LowerBody = muscleGroups.filter(mg => 
    ['quadriceps', 'hamstrings', 'glutes', 'calves', 'legs'].includes(mg.group)
  );
  
  const muscleGroups_Others = muscleGroups.filter(mg => 
    !['chest', 'shoulders', 'triceps', 'back', 'biceps', 'forearms', 'traps', 'lats', 'rhomboids', 'trapezius',
      'core', 'abs', 'abdominals', 'obliques', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'legs',
      'cardiovascular', 'mobility'].includes(mg.group)
  );
  
  const muscleGroups_Cardio = muscleGroups.filter(mg => 
    ['cardiovascular'].includes(mg.group)
  );
  
  const muscleGroups_Mobility = muscleGroups.filter(mg => 
    ['mobility'].includes(mg.group)
  );

  if (compact) {
    // Compact view - show a visual overview
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {muscleGroups
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 6)
            .map((mg) => (
              <div key={mg.group} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <AlertTriangle className="w-3.5 h-3.5 ml-1 text-amber-500" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 ml-1 text-green-500" />
                    )}
                  </div>
                  <span className="text-muted-foreground">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-green-500'}`}
                />
              </div>
            ))}
        </div>
        
        {muscleGroups.length > 6 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing top 6 of {muscleGroups.length} muscle groups. 
            View detailed analysis for complete breakdown.
          </p>
        )}
      </div>
    );
  }

  // Detailed view - show all muscle group categories with visualization
  return (
    <div className="space-y-8">
      {/* Upper Body - Push */}
      {muscleGroups_UpperBodyPush.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Upper Body - Push</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {muscleGroups_UpperBodyPush.map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-blue-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upper Body - Pull */}
      {muscleGroups_UpperBodyPull.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Upper Body - Pull</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {muscleGroups_UpperBodyPull.map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-indigo-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core */}
      {muscleGroups_Core.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Core</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {muscleGroups_Core.map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-yellow-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lower Body */}
      {muscleGroups_LowerBody.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Lower Body</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {muscleGroups_LowerBody.map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-purple-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cardio & Mobility */}
      {(muscleGroups_Cardio.length > 0 || muscleGroups_Mobility.length > 0) && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Cardio & Mobility</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...muscleGroups_Cardio, ...muscleGroups_Mobility].map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-green-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Muscle Groups */}
      {muscleGroups_Others.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">Other Muscle Groups</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {muscleGroups_Others.map((mg) => (
              <div key={mg.group} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{capitalize(mg.group)}</span>
                    {mg.neglected ? (
                      <Badge variant="outline" className="text-xs py-0 h-5 border-amber-300 text-amber-700">
                        Neglected
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground font-mono">{mg.frequency.toFixed(1)}</span>
                </div>
                <Progress 
                  value={(mg.frequency / maxFrequency) * 100} 
                  className={`h-2.5 ${mg.neglected ? 'bg-amber-100' : 'bg-muted'} [&>[data-slot=progress-indicator]]:${mg.neglected ? 'bg-amber-500' : 'bg-gray-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 