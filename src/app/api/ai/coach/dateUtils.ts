import { startOfWeek, endOfWeek, addWeeks, startOfDay, endOfDay } from 'date-fns';

// Define the extended period type directly in this file for clarity
export type ExtendedPeriodType = 
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | "this_year"
    | "last_year"
    | "last_7_days"
    | "last_30_days"
    | "overall"
    | "next_week"; // Added next_week

/**
 * Calculates start and end dates for common period descriptions.
 * @param period - e.g., "last_month", "this_week", "last_7_days", "next_week"
 * @returns Object with start_date, end_date (ISO strings), and period_description
 */
export function calculateDateRange(
  period: ExtendedPeriodType // Use the extended type
  // Removed explicit start/end date parameters as they are handled in the main route
): { start_date?: string; end_date?: string; period_description: string } {
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  let description: string = period.replace(/_/g, " "); // Default description

  // Helper functions for start/end of day (consider using date-fns versions if preferred)
  const startOfDayLocal = (date: Date) => new Date(date.setHours(0, 0, 0, 0));
  const endOfDayLocal = (date: Date) => new Date(date.setHours(23, 59, 59, 999));

  switch (period) {
    case "today":
      startDate = startOfDayLocal(new Date(now));
      endDate = endOfDayLocal(new Date(now));
      description = "today";
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = startOfDayLocal(yesterday);
      endDate = endOfDayLocal(yesterday);
      description = "yesterday";
      break;
    case "this_week":
      // Use date-fns for week calculations (assuming week starts on Monday)
      startDate = startOfWeek(now, { weekStartsOn: 1 }); 
      endDate = endOfWeek(now, { weekStartsOn: 1 });
      description = "this week";
      break;
    case "last_week":
      const startOfLastWeek = startOfWeek(addWeeks(now, -1), { weekStartsOn: 1 });
      startDate = startOfLastWeek;
      endDate = endOfWeek(startOfLastWeek, { weekStartsOn: 1 });
      description = "last week";
      break;
    case "next_week": // Added case for next_week
      const startOfNextWeek = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
      startDate = startOfNextWeek;
      endDate = endOfWeek(startOfNextWeek, { weekStartsOn: 1 });
      description = "next week";
      break;
    case "this_month":
      startDate = startOfDayLocal(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = endOfDayLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      description = "this month";
      break;
    case "last_month":
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = startOfDayLocal(firstDayOfLastMonth);
      endDate = endOfDayLocal(new Date(now.getFullYear(), now.getMonth(), 0));
      description = "last month";
      break;
    case "this_year":
      startDate = startOfDayLocal(new Date(now.getFullYear(), 0, 1));
      endDate = endOfDayLocal(new Date(now.getFullYear(), 11, 31));
      description = "this year";
      break;
    case "last_year":
      startDate = startOfDayLocal(new Date(now.getFullYear() - 1, 0, 1));
      endDate = endOfDayLocal(new Date(now.getFullYear() - 1, 11, 31));
      description = "last year";
      break;
    case "last_7_days":
      endDate = endOfDayLocal(new Date(now)); // Today end of day
      startDate = startOfDayLocal(new Date(new Date().setDate(now.getDate() - 6))); // 6 days before today (inclusive makes 7 days)
      description = "last 7 days";
      break;
    case "last_30_days":
      endDate = endOfDayLocal(new Date(now)); // Today end of day
      startDate = startOfDayLocal(new Date(new Date().setDate(now.getDate() - 29))); // 29 days before today (inclusive makes 30 days)
      description = "last 30 days";
      break;
    case "overall":
      startDate = undefined; // Representing from the beginning of time
      endDate = endOfDayLocal(new Date(now)); // Up to now
      description = "overall";
      break;
  }

  return {
    start_date: startDate?.toISOString(),
    end_date: endDate?.toISOString(),
    period_description: description,
  };
}

// Helper to parse more complex date strings (Placeholder - requires a library like date-fns or moment)
// export function parseDateString(dateString: string): Date | null {
//   // TODO: Implement robust date parsing (e.g., "tuesday", "october 15th", "2 days ago")
//   return null;
// } 