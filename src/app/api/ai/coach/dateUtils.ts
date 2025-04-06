/**
 * Calculates start and end dates for common period descriptions.
 * @param period - e.g., "last_month", "this_week", "last_7_days"
 * @returns Object with start_date, end_date (ISO strings), and period_description
 */
export function calculateDateRange(
  period:
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
): { start_date?: string; end_date?: string; period_description: string } {
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  let description: string = period.replace(/_/g, " "); // Default description

  // Set time to start/end of day for consistency
  const startOfDay = (date: Date) => new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = (date: Date) => new Date(date.setHours(23, 59, 59, 999));

  switch (period) {
    case "today":
      startDate = startOfDay(new Date(now));
      endDate = endOfDay(new Date(now));
      description = "today";
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      description = "yesterday";
      break;
    case "this_week":
      const firstDayOfWeek = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1); // Assuming Monday is the first day
      startDate = startOfDay(new Date(now.setDate(firstDayOfWeek)));
      endDate = endOfDay(new Date(startDate)); // Start with the start date
      endDate.setDate(startDate.getDate() + 6); // Go to the end of the week (Sunday)
      endDate = endOfDay(endDate); // Ensure it's the end of Sunday
      description = "this week";
      break;
    case "last_week":
      const firstDayOfLastWeek = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) - 7;
      startDate = startOfDay(new Date(new Date().setDate(firstDayOfLastWeek))); // Use new Date() to avoid mutation side effects
      endDate = endOfDay(new Date(startDate)); // Start with the start date
      endDate.setDate(startDate.getDate() + 6); // Go to the end of last week (Sunday)
      endDate = endOfDay(endDate); // Ensure it's the end of Sunday
      description = "last week";
      break;
    case "this_month":
      startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      description = "this month";
      break;
    case "last_month":
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = startOfDay(firstDayOfLastMonth);
      endDate = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      description = "last month";
      break;
    case "this_year":
      startDate = startOfDay(new Date(now.getFullYear(), 0, 1));
      endDate = endOfDay(new Date(now.getFullYear(), 11, 31));
      description = "this year";
      break;
    case "last_year":
      startDate = startOfDay(new Date(now.getFullYear() - 1, 0, 1));
      endDate = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
      description = "last year";
      break;
    case "last_7_days":
      endDate = endOfDay(new Date(now)); // Today end of day
      startDate = startOfDay(new Date(now.setDate(now.getDate() - 6))); // 6 days before today (inclusive makes 7 days)
      description = "last 7 days";
      break;
    case "last_30_days":
      endDate = endOfDay(new Date(now)); // Today end of day
      startDate = startOfDay(new Date(new Date().setDate(now.getDate() - 29))); // 29 days before today (inclusive makes 30 days)
      description = "last 30 days";
      break;
    case "overall":
      startDate = undefined; // Representing from the beginning of time
      endDate = endOfDay(new Date(now)); // Up to now
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