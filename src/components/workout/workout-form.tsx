import { LucideDumbbell, LucideFootprints, LucideWaves, LucideBike, LucideHeartPulse } from "lucide-react";

<main className="container max-w-2xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
  <div className="space-y-2 sm:space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-base sm:text-lg font-semibold tracking-tight">Activity Type</h2>
      <button className="inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-[hsl(216_15%_35%)] dark:text-[hsl(210_40%_98%)] h-8 sm:h-9 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-calendar mr-1.5 h-3 w-3 sm:h-4 sm:w-4">
          <path d="M8 2v4"></path>
          <path d="M16 2v4"></path>
          <rect width="18" height="18" x="3" y="4" rx="2"></rect>
          <path d="M3 10h18"></path>
        </svg>
        Today
      </button>
    </div>

    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2">
      {activityTypes.map((type) => (
        <button
          key={type.id}
          onClick={() => setSelectedActivityType(type.id)}
          className={cn(
            "whitespace-nowrap text-xs sm:text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground h-8 sm:h-10 flex flex-col items-center justify-center gap-1 rounded-xl p-1 sm:p-2 hover:bg-accent transition-colors",
            selectedActivityType === type.id && "bg-primary/10 text-primary"
          )}
        >
          <type.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[10px] sm:text-xs font-medium">{type.name}</span>
        </button>
      ))}
    </div>

    <div className="px-2 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
      {exercises.map((exercise, index) => (
        <div key={exercise.id} className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">{index + 1}</span>
              <select
                value={exercise.name}
                onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                className="flex h-8 sm:h-9 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-1 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {/* ... options ... */}
              </select>
            </div>
            <button
              onClick={() => removeExercise(index)}
              className="inline-flex items-center justify-center rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground h-7 sm:h-8 w-7 sm:w-8 p-1 sm:p-1.5"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="space-y-1 sm:space-y-1.5">
              <label className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Sets
              </label>
              <input
                type="number"
                value={exercise.sets}
                onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value))}
                className="flex h-8 sm:h-9 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-1 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <label className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Reps
              </label>
              <input
                type="number"
                value={exercise.reps}
                onChange={(e) => handleExerciseChange(index, 'reps', parseInt(e.target.value))}
                className="flex h-8 sm:h-9 w-full sm:w-1/2 md:w-20 rounded-md border border-input bg-background px-2 sm:px-3 py-1 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <label className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Weight (kg)
              </label>
              <input
                type="number"
                value={exercise.weight}
                onChange={(e) => handleExerciseChange(index, 'weight', parseFloat(e.target.value))}
                className="flex h-8 sm:h-9 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-1 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addExercise}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 sm:h-9 px-2 sm:px-3 py-1 sm:py-1.5"
      >
        <Plus className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4" />
        Add Exercise
      </button>
    </div>
  </div>
</main> 