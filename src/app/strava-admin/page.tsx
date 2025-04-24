'use client'; // Make this a client component

import React, { useState, useEffect, useCallback } from 'react';
// No direct import of IWorkout needed if we define the list item type here

interface StravaStatus {
  connected: boolean;
  account?: {
    tokenValid?: boolean;
    apiCallSuccess?: boolean;
    athleteId?: string;
  };
}

// TODO: Define a type for Sync Result/History if needed
interface SyncResult {
  success: boolean;
  message?: string;
  newActivitiesCount?: number;
  error?: string;
}

// Define the shape of the workout data we expect from the API
// Ensure _id is explicitly a string
interface WorkoutListItem {
  _id: string; // Expecting string after JSON serialization
  name: string;
  date: string; // Expecting string date from JSON
  type: string;
  distance?: number;
  duration?: number;
}

// State for individual image generation status
interface ImageGenState {
  isLoading: boolean;
  // imageUrl?: string; // Store base64 string instead
  imageBase64?: string; 
  error?: string;
}

export default function StravaAdminPage() {
  const [stravaStatus, setStravaStatus] = useState<StravaStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [activities, setActivities] = useState<WorkoutListItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  // State map for image generation: { [activityId]: ImageGenState }
  const [imageGenStates, setImageGenStates] = useState<Record<string, ImageGenState>>({});

  const fetchActivities = useCallback(async () => {
    if (!stravaStatus?.connected) return; 

    setIsLoadingActivities(true);
    setImageGenStates({}); // Reset image states when fetching activities
    try {
      const response = await fetch('/api/strava-admin/activities');
      const data: { success: boolean; workouts?: WorkoutListItem[]; error?: string } = await response.json();
      if (response.ok && data.success) {
        setActivities(data.workouts || []);
      } else {
        console.error("Failed to fetch activities:", data?.error || 'Unknown error');
        setActivities([]);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [stravaStatus?.connected]);

  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const response = await fetch('/api/strava-status');
        const data: StravaStatus = await response.json();
        if (response.ok) {
          setStravaStatus(data);
          if (data.connected) {
            fetchActivities();
          }
        } else {
          console.error("Failed to fetch Strava status:", data);
          setStravaStatus({ connected: false });
        }
      } catch (error) {
        console.error("Error fetching Strava status:", error);
        setStravaStatus({ connected: false });
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [fetchActivities]);

  const handleConnect = async () => {
    setIsConnecting(true);
    window.location.href = '/api/strava/authorize';
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/strava/sync-recent', { method: 'POST' });
      const data: SyncResult = await response.json();
      setSyncResult(data);
      if (!response.ok) {
        console.error("Sync failed:", data);
      } else {
        fetchActivities(); 
      }
    } catch (error) {
      console.error("Error syncing workouts:", error);
      setSyncResult({ success: false, error: 'An unexpected error occurred during sync.' });
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleGenerateImage = async (activityId: string) => {
    setImageGenStates(prev => ({ ...prev, [activityId]: { isLoading: true } }));

    try {
      const response = await fetch('/api/strava-admin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });

      // Expect imageBase64 in the response now
      const data: { success: boolean; imageBase64?: string; error?: string } = await response.json();

      if (response.ok && data.success) {
        setImageGenStates(prev => ({
          ...prev,
          // Store imageBase64
          [activityId]: { isLoading: false, imageBase64: data.imageBase64 },
        }));
      } else {
        console.error(`Image generation failed for ${activityId}:`, data.error);
        setImageGenStates(prev => ({
          ...prev,
          [activityId]: { isLoading: false, error: data.error || 'Failed to generate image.' },
        }));
      }
    } catch (error) {
      console.error(`Error calling image generation API for ${activityId}:`, error);
      setImageGenStates(prev => ({
        ...prev,
        [activityId]: { isLoading: false, error: 'An unexpected error occurred.' },
      }));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Strava Admin</h1>
      
      {/* Section for Strava Connection */}
      <div className="mb-6 p-4 border rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Strava Connection</h2>
        {isLoadingStatus ? (
          <p>Loading status...</p>
        ) : stravaStatus?.connected ? (
          <p className="text-green-600">Status: Connected (Athlete ID: {stravaStatus.account?.athleteId || 'N/A'})</p>
        ) : (
          <>
            <p className="text-red-600">Status: Not Connected</p>
            <button 
              onClick={handleConnect} 
              disabled={isConnecting || isLoadingStatus}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isConnecting ? 'Redirecting...' : 'Connect Strava'}
            </button>
          </>
        )}
      </div>

      {/* Section for Sync Status and History */}
      {stravaStatus?.connected && (
        <div className="p-4 border rounded shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Sync Status & Activities</h2>
          <button 
            onClick={handleSync}
            disabled={isSyncing || isLoadingActivities} // Also disable if loading activities
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Recent Workouts'}
          </button>
          
          {/* Display Sync Status/Result */}
          {isSyncing && <p>Sync in progress...</p>}
          {syncResult && (
            <p className={`mt-2 ${syncResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {syncResult.success 
                ? `Sync successful! ${syncResult.newActivitiesCount ?? 'Some'} new activities processed. ${syncResult.message || ''}` 
                : `Sync failed: ${syncResult.error || 'Unknown reason'}`}
            </p>
          )}

          <h3 className="text-lg font-medium mb-2 mt-4">Recent Strava Activities</h3>
          {isLoadingActivities ? (
            <p>Loading activities...</p>
          ) : activities.length > 0 ? (
            <ul className="space-y-4">
              {activities.map((activity) => {
                const imageState = imageGenStates[activity._id];
                return (
                  <li key={activity._id} className="p-3 border rounded shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold text-lg">{activity.name || 'Untitled Workout'}</span>
                        <span className="text-sm text-gray-600 ml-2">({activity.type})</span>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(activity.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} - 
                          {activity.distance && activity.distance > 0 ? `${(activity.distance / 1000).toFixed(2)} km` : 'N/A'} - 
                          {activity.duration ? `${Math.floor(activity.duration / 60)} min ${activity.duration % 60} sec` : 'N/A'}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleGenerateImage(activity._id)}
                        disabled={imageState?.isLoading || isSyncing}
                        className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 whitespace-nowrap ml-4"
                      >
                        {imageState?.isLoading ? 'Generating...' : 'Generate Image'}
                      </button>
                    </div>

                    {imageState?.error && (
                      <p className="text-red-600 text-sm mt-2">Error: {imageState.error}</p>
                    )}
                    {imageState?.imageBase64 && (
                      <div className="mt-2 text-center">
                        <img 
                          src={`data:image/png;base64,${imageState.imageBase64}`} 
                          alt={`Generated image for ${activity.name || 'workout'}`}
                          className="max-w-lg rounded shadow inline-block"
                        />
                        <p className="mt-2 font-serif text-lg text-gray-700">
                          {activity.distance && activity.distance > 0 ? `${(activity.distance / 1000).toFixed(2)} km` : ''}
                          {activity.distance && activity.distance > 0 && activity.duration ? ' / ' : ''}
                          {activity.duration ? `${Math.floor(activity.duration / 60)} min ${activity.duration % 60} sec` : ''}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No recent Strava activities found. Try syncing.</p>
          )}
        </div>
      )}
    </div>
  );
} 