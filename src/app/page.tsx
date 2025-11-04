import { TrainingController } from '@/components/app/training-controller';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 sm:p-10 shadow-2xl">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold mb-2 text-primary">Apnea Training Tables</h1>
            <p className="text-gray-300 text-lg">Select a training protocol and enter your PB to begin your session.</p>
        </div>
        <TrainingController />
         <p className="text-xs text-gray-600 mt-8 text-center">Remember: Never train alone or near water.</p>
      </div>
    </main>
  );
}
