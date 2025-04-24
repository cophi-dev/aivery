import Image from 'next/image';

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div 
      id="page-loading-indicator"
      className="fixed inset-0 flex items-center justify-center bg-background z-50"
    >
      <Image 
        src="/icons/aivery.svg" 
        alt="Loading Aivery..." 
        width={100} // Adjust size as needed
        height={100} // Adjust size as needed
        priority // Load the logo quickly
      />
    </div>
  )
} 