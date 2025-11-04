"use client";

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import * as Tone from 'tone';

import { generateCo2Table, generateO2Table } from '@/lib/tables';
import type { TrainingPhase, TrainingRound } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimerDisplay } from './timer-display';
import { SafetyWarning } from './safety-warning';

const FormSchema = z.object({
  pb: z.coerce.number().int().min(30, "Min PB is 30s").max(600, "Max PB is 600s"),
});

type FormValues = z.infer<typeof FormSchema>;

export function TrainingController() {
  const [tableType, setTableType] = React.useState<'co2' | 'o2'>('co2');
  const [tableData, setTableData] = React.useState<TrainingRound[] | null>(null);
  const [isSessionActive, setIsSessionActive] = React.useState(false);
  const [currentRoundIndex, setCurrentRoundIndex] = React.useState(0);
  const [currentPhase, setCurrentPhase] =
    React.useState<TrainingPhase | 'finished' | 'ready'>('ready');
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [showStopModal, setShowStopModal] = React.useState(false);
  const [showAlert, setShowAlert] = React.useState(false);
  const [alertMessage, setAlertMessage] = React.useState('');

  const synth = React.useRef<Tone.Synth | null>(null);
  const timerId = React.useRef<NodeJS.Timeout | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { pb: 90 },
  });

  React.useEffect(() => {
    // Initialize Tone.js synth on the client side
    if (typeof window !== 'undefined') {
        // Create synth and immediately dispose of it to initialize audio context
        // This is a workaround for browsers that require user interaction to start audio
        new Tone.Synth().toDestination().dispose(); 
        // Then create the one we'll actually use
        synth.current = new Tone.Synth().toDestination();
    }
    return () => {
      synth.current?.dispose();
    };
  }, []);

  const playTone = async (freq: number, duration: Tone.Unit.Time) => {
    try {
      if (synth.current) {
        // Ensure AudioContext is running
        if (Tone.context.state !== 'running') {
          await Tone.context.resume();
        }
        synth.current.triggerAttackRelease(freq, duration);
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const playEndSound = () => playTone(500, '8n');
  const playStartSound = () => playTone(700, '8n');
  const playTickSound = () => playTone(900, '16n');

  const advancePhase = React.useCallback(() => {
    if (!tableData) return;
  
    if (currentPhase === 'hold') {
      if (currentRoundIndex === tableData.length - 1) {
        setCurrentPhase('finished');
        setIsSessionActive(false);
        return;
      }
      setCurrentPhase('prep');
      setCurrentRoundIndex(prev => prev + 1);
    } else if (currentPhase === 'prep') {
      setCurrentPhase('hold');
    }
  }, [currentPhase, currentRoundIndex, tableData]);

  React.useEffect(() => {
    if (!isSessionActive || !tableData || currentPhase === 'ready' || currentPhase === 'finished') {
        if(timerId.current) clearTimeout(timerId.current);
        return;
    };
    
    const round = tableData[currentRoundIndex];
    if (!round) {
        setIsSessionActive(false);
        setCurrentPhase('finished');
        return;
    }

    const duration = currentPhase === 'prep' ? round.prep : round.hold;
    setTimeRemaining(duration);
    playStartSound();

  }, [isSessionActive, currentPhase, currentRoundIndex, tableData]);
  
  
  React.useEffect(() => {
    if (!isSessionActive || timeRemaining <= 0) {
        if(timeRemaining === 0 && isSessionActive) {
            playEndSound();
            advancePhase();
        }
        if (timerId.current) clearTimeout(timerId.current);
        return;
    }

    timerId.current = setTimeout(() => {
      setTimeRemaining(t => t - 1);
      if (timeRemaining > 1 && timeRemaining <= 4) {
        playTickSound();
      }
    }, 1000);

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [isSessionActive, timeRemaining, advancePhase]);
  

  function onSubmit(data: FormValues) {
    if (tableType === 'co2' && data.pb < 30) {
        setAlertMessage("Please enter a comfortable Personal Best time of at least 30 seconds for CO₂ tables.");
        setShowAlert(true);
        return;
    }
    if (tableType === 'o2' && data.pb < 60) {
        setAlertMessage("O₂ tables are dangerous. Please enter a Personal Best time of at least 60 seconds to ensure you are experienced enough.");
        setShowAlert(true);
        return;
    }
    
    const newTable = tableType === 'co2' ? generateCo2Table(data.pb) : generateO2Table(data.pb);
    setTableData(newTable);
    resetSessionState();
  }
  
  const resetSessionState = () => {
     setIsSessionActive(false);
     setCurrentRoundIndex(0);
     setCurrentPhase('ready');
     setTimeRemaining(0);
     if(timerId.current) clearTimeout(timerId.current);
  }

  const startSession = async () => {
    if (!tableData) return;
     // Ensure AudioContext is active before starting
    await Tone.start();
    setIsSessionActive(true);
    setCurrentRoundIndex(0);
    setCurrentPhase('prep');
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setShowStopModal(false);
    resetSessionState();
    setTableData(null);
    form.reset();
  };

  const SetupView = () => (
    <div className='space-y-6'>
       <SafetyWarning tableType={tableType} />
       <TableForm description={
           tableType === 'co2' 
           ? "Enter your maximum comfortable breath-hold time (PB). The table's hold time will be ~60-70% of your PB, with decreasing recovery periods."
           : "Enter your maximum comfortable breath-hold time (PB). The table will have increasing hold times with a constant 2-minute recovery."
       } />
    </div>
  );

  const TableForm = ({ description }: { description: string }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" >
         <p className="text-sm text-gray-300 px-1">{description}</p>
        <div className="flex items-start space-x-3">
          <FormField
            control={form.control}
            name="pb"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input type="number" placeholder="e.g., 90 (seconds)" {...field} className="h-12 text-lg" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="h-12 font-semibold whitespace-nowrap">
             Generate Table
          </Button>
        </div>
      </form>
    </Form>
  );
  
  const SessionView = () => (
    <div className="space-y-6">
      <TimerDisplay
        phase={ currentPhase }
        timeRemaining={timeRemaining}
        currentRound={currentRoundIndex + 1}
        totalRounds={tableData?.length ?? 0}
        holdTarget={tableData?.[currentRoundIndex]?.hold ?? 0}
      />
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="destructive"
          className="w-full py-3 font-semibold text-lg"
          onClick={() => setShowStopModal(true)}
        >
          STOP SESSION
        </Button>
      </div>
    </div>
  );

  const SessionCompletionView = () => (
     <div className="text-center p-8 rounded-lg bg-green-900/50 text-green-200 border border-green-700 space-y-4 flex flex-col items-center">
        <p className="text-2xl font-bold">Session Complete!</p>
        <p className="text-green-300">Congratulations! Remember to recover fully and wait at least 24 hours before your next session.</p>
        <Button onClick={stopSession} className="mt-4 w-full sm:w-auto" variant="secondary">
            Start New Session
        </Button>
    </div>
  )
  
  const handleTabChange = (value: string) => {
    setTableType(value as 'co2' | 'o2');
    setTableData(null);
    form.reset();
    resetSessionState();
  };

  if (currentPhase === 'finished') {
    return <SessionCompletionView />;
  }

  return (
    <section className="w-full space-y-6">
      <Tabs value={tableType} onValueChange={handleTabChange} className="w-full" >
        <TabsList className="grid w-full grid-cols-2 bg-secondary">
          <TabsTrigger value="co2">CO₂ Tolerance Table</TabsTrigger>
          <TabsTrigger value="o2">O₂ Tolerance Table</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {isSessionActive ? <SessionView /> : <SetupView />}

      {tableData && !isSessionActive && (
        <div className="mt-8 space-y-6">
            <h3 className="text-xl font-semibold text-center text-primary">Your Training Protocol</h3>
            <div className="rounded-lg overflow-hidden border border-border">
                <Table>
                    <TableHeader className="bg-secondary/50">
                    <TableRow>
                        <TableHead className="px-4 py-3 w-[60px]">Set</TableHead>
                        <TableHead className="px-4 py-3">{tableType === 'co2' ? 'Prep (Recovery)' : 'Prep (2:00)'}</TableHead>
                        <TableHead className="px-4 py-3">{tableType === 'co2' ? 'Hold (Constant)' : 'Hold (Increasing)'}</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {tableData.map((row) => (
                        <TableRow key={row.round} className="hover:bg-accent/50">
                        <TableCell className="px-4 py-3 font-medium">{row.round}</TableCell>
                        <TableCell className="px-4 py-3 font-mono">{formatTime(row.prep)}</TableCell>
                        <TableCell className="px-4 py-3 font-mono">{formatTime(row.hold)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          
          <div className="flex justify-center pt-2">
            <Button onClick={startSession} size="lg" className="w-full font-bold text-lg tracking-wider">
              START SESSION
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showStopModal} onOpenChange={setShowStopModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will end your current training session and reset your progress.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={stopSession} variant="destructive">
              Confirm Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invalid Input</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAlert(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
