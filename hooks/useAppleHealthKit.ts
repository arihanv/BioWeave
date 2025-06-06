import { useCallback, useEffect, useState } from "react";
import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
  HealthActivitySummary,
} from "react-native-health";

export type HealthKitStatus = "uninitialized" | "initializing" | "ready" | "error";

// Define the permissions you want to request
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.ActivitySummary,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned
    ],
    write: [],
  },
};

export function useAppleHealthKit() {
  const [status, setStatus] = useState<HealthKitStatus>("uninitialized");
  const [error, setError] = useState<string | null>(null);

  // Initialize HealthKit and request permissions
  useEffect(() => {
    setStatus("initializing");
    AppleHealthKit.initHealthKit(permissions, (err: string) => {
      if (err) {
        setError(err);
        setStatus("error");
      } else {
        setStatus("ready");
      }
    });
  }, []);

  // Fetch step count samples
  const getStepCountSamples = useCallback(
    (options: HealthInputOptions): Promise<HealthValue[]> => {
      return new Promise((resolve, reject) => {
        AppleHealthKit.getDailyStepCountSamples(
          options,
          (err: string, result: HealthValue[]) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
    },
    []
  );

  // Fetch heart rate samples
  const getHeartRateSamples = useCallback(
    (options: HealthInputOptions): Promise<HealthValue[]> => {
      return new Promise((resolve, reject) => {
        AppleHealthKit.getHeartRateSamples(
          options,
          (err: string, results: HealthValue[]) => {
            if (err) {
              reject(err);
            } else {
              resolve(results);
            }
          }
        );
      });
    },
    []
  );

  const getActivitySummary = useCallback(
    (options: HealthInputOptions): Promise<HealthActivitySummary[]> => {
      return new Promise((resolve, reject) => {
        AppleHealthKit.getActivitySummary(options, (err: string, results: HealthActivitySummary[]) => {
          console.log("results", results);
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });
    },
    []
  );

  const getCaloriesBurned = useCallback(
    (options: HealthInputOptions): Promise<HealthValue[]> => {
      return new Promise((resolve, reject) => {
        AppleHealthKit.getActiveEnergyBurned(options, (err: string, results: HealthValue[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });
    },
    []
  );

  return {
    status,
    error,
    getStepCountSamples,
    getHeartRateSamples,  
    getActivitySummary,
    getCaloriesBurned,
  };
}
