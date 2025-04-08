import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-4">
          Welcome to Aivery Fitness
        </h1>

        <p className="mt-3 text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl">
          Your AI-powered personal trainer. Get customized workout plans and reach your fitness goals faster.
        </p>

        <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full space-y-4 sm:space-y-0 sm:space-x-4">
          <Link href="/register" className="p-6 mt-6 text-left border w-full sm:w-96 rounded-xl hover:text-blue-600 focus:text-blue-600 bg-white shadow-md hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-2xl font-bold">Get Started &rarr;</h3>
            <p className="mt-4 text-xl">
              Sign up today and start your personalized fitness journey.
            </p>
          </Link>

          <Link href="/login" className="p-6 mt-6 text-left border w-full sm:w-96 rounded-xl hover:text-blue-600 focus:text-blue-600 bg-white shadow-md hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-2xl font-bold">Login &rarr;</h3>
            <p className="mt-4 text-xl">
              Already have an account? Access your dashboard.
            </p>
              </Link>
        </div>
      </main>

      <footer className="flex items-center justify-center w-full h-24 border-t mt-10">
        <p className="text-gray-500">
          © {new Date().getFullYear()} Aivery Fitness. All rights reserved.
        </p>
      </footer>
    </div>
  );
}


