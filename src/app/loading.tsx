import Image from 'next/image';

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <Image 
        src="/icons.ico/aivery.svg" 
        alt="Loading Aivery..." 
        width={100} // Adjust size as needed
        height={100} // Adjust size as needed
        priority // Load the logo quickly
        className="animate-pulse"
      />
    </div>
  )
} 