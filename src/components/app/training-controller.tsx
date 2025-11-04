"use client";

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import * as Tone from 'tone';
import {
  Play,
  Square,
  Zap,
} from 'lucide-react';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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

const FormSchema = z
  .object({
    minutes: z.coerce.number().int().min(0).max(10).default(0),
    seconds: z.coerce.number().int().min(0).max(59).default(0),
  })
  .refine((data) => data.minutes * 60 + data.seconds > 0, {
    message: 'Total time must be greater than zero.',
    path: ['minutes'],
  })
  .refine((data) => data.minutes * 60 + data.seconds < 600, {
    message: 'Personal best seems too high. Are you a dolphin?',
    path: ['minutes'],
  });

type FormValues = z.infer<typeof FormSchema>;

export function TrainingController() {
  const [tableType, setTableType] = React.useState<'co2' | 'o2'>('co2');
  const [tableData, setTableData] = React.useState<TrainingRound[] | null>(
    null
  );
  const [isSessionActive, setIsSessionActive] = React.useState(false);
  const [currentRoundIndex, setCurrentRoundIndex] = React.useState(0);
  const [currentPhase, setCurrentPhase] =
    React.useState<TrainingPhase>('prep');
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [showStopModal, setShowStopModal] = React.useState(false);

  const synth = React.useRef<Tone.Synth | null>(null);
  const timerId = React.useRef<NodeJS.Timeout | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { minutes: 2, seconds: 30 },
  });

  React.useEffect(() => {
    // Tone.js can only be initialized on the client side.
    if (typeof window !== 'undefined') {
        synth.current = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
        }).toDestination();
    }
    return () => {
      synth.current?.dispose();
    };
  }, []);

  const playSound = (note: string, duration: string) => {
    if (synth.current && Tone.context.state !== 'running') {
      Tone.context.resume();
    }
    synth.current?.triggerAttackRelease(note, duration);
  };
  
  const playStartSound = () => playSound('C5', '8n');
  const playEndSound = () => playSound('G5', '8n');
  const playTickSound = () => playSound('C4', '16n');

  const advancePhase = React.useCallback(() => {
    if (!tableData) return;

    let nextPhase: TrainingPhase | 'finished' = currentPhase;
    let nextRoundIndex = currentRoundIndex;

    if (currentPhase === 'prep') {
        nextPhase = 'hold';
    } else if (currentPhase === 'hold') {
        nextPhase = 'recovery';
    } else if (currentPhase === 'recovery') {
        nextPhase = 'prep';
        nextRoundIndex++;
    }

    if (nextRoundIndex >= tableData.length || (tableData[nextRoundIndex].recovery === 0 && currentPhase === 'hold')) {
      setIsSessionActive(false);
      setCurrentPhase('finished');
      return;
    }
    
    const nextRound = tableData[nextRoundIndex];
    const nextDuration = nextRound[nextPhase as TrainingPhase];

    setCurrentPhase(nextPhase as TrainingPhase);
    setCurrentRoundIndex(nextRoundIndex);
    setTimeRemaining(nextDuration);
    playStartSound();
  }, [currentPhase, currentRoundIndex, tableData]);


  React.useEffect(() => {
    let active = isSessionActive;

    if (active && timeRemaining === 0) {
      playEndSound();
      advancePhase();
    }
    
    return () => { active = false };
  }, [isSessionActive, timeRemaining, advancePhase, playEndSound]);

  React.useEffect(() => {
    if (!isSessionActive || timeRemaining <= 0) {
      if (timerId.current) clearTimeout(timerId.current);
      return;
    }

    timerId.current = setTimeout(() => {
      setTimeRemaining(timeRemaining - 1);
      if (timeRemaining > 1 && timeRemaining <= 4) {
        playTickSound();
      }
    }, 1000);

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [isSessionActive, timeRemaining, playTickSound]);

  function onSubmit(data: FormValues) {
    const totalSeconds = data.minutes * 60 + data.seconds;
    const newTable =
      tableType === 'co2'
        ? generateCo2Table(totalSeconds)
        : generateO2Table(totalSeconds);
    setTableData(newTable);
    // Reset session state if a new table is generated
    setIsSessionActive(false);
    setCurrentRoundIndex(0);
    setCurrentPhase('prep');
  }

  const startSession = () => {
    if (!tableData) return;
    setIsSessionActive(true);
    setCurrentRoundIndex(0);
    setCurrentPhase('prep');
    setTimeRemaining(tableData[0].prep);
    playStartSound();
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setShowStopModal(false);
    if (timerId.current) clearTimeout(timerId.current);
    // Do not reset table data, just the session
    setCurrentRoundIndex(0);
    setCurrentPhase('prep');
    setTimeRemaining(0);
  };
  
  const confirmStopSession = () => {
    stopSession();
  };

  const SetupView = () => (
    <Tabs
      defaultValue="co2"
      onValueChange={(v) => {
        setTableType(v as 'co2' | 'o2');
        setTableData(null);
        form.reset();
      }}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="co2">CO₂ Tolerance Table</TabsTrigger>
        <TabsTrigger value="o2">O₂ Deprivation Table</TabsTrigger>
      </TabsList>
      <TabsContent value="co2">
        <TableForm description="Generates a table with constant holds and decreasing rests to improve CO₂ tolerance." />
      </TabsContent>
      <TabsContent value="o2">
        <TableForm description="Generates a table with increasing holds and constant rests to improve O₂ tolerance." />
      </TabsContent>
    </Tabs>
  );

  const TableForm = ({ description }: { description: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Personal Best</CardTitle>
        <p className="text-muted-foreground pt-2">{description}</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="flex gap-4 items-start">
              <FormField
                control={form.control}
                name="minutes"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Minutes</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seconds"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Seconds</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormMessage>{form.formState.errors.minutes?.message}</FormMessage>
            <Button type="submit" className="w-full">
              <Zap className="mr-2 h-4 w-4" /> Generate Table
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const SessionView = () => (
    <div className="space-y-8">
      <TimerDisplay
        phase={ currentPhase }
        timeRemaining={timeRemaining}
        currentRound={currentRoundIndex + 1}
        totalRounds={tableData?.length ?? 0}
      />
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="destructive"
          size="lg"
          onClick={() => setShowStopModal(true)}
        >
          <Square className="mr-2 h-5 w-5" /> Stop Session
        </Button>
      </div>
    </div>
  );
  
    const isFinished = !isSessionActive && currentPhase === 'finished' && tableData !== null;

    if (isFinished) {
        return (
            <div className="w-full space-y-8 text-center">
                 <TimerDisplay
                    phase={'finished'}
                    timeRemaining={0}
                    currentRound={tableData?.length ?? 0}
                    totalRounds={tableData?.length ?? 0}
                />
                <Button size="lg" onClick={() => {
                    setTableData(null);
                    setCurrentPhase('prep');
                }}>
                    Create New Table
                </Button>
            </div>
        );
    }


  return (
    <section className="w-full">
      {isSessionActive ? <SessionView /> : <SetupView />}

      {tableData && !isSessionActive && (
        <div className="mt-8">
          <h3 className="text-2xl font-semibold mb-4 text-center">
            Your Training Table
          </h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] text-center">Round</TableHead>
                    <TableHead>Prep</TableHead>
                    <TableHead>Hold</TableHead>
                    <TableHead>Recovery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow
                      key={row.round}
                      data-active={isSessionActive && index === currentRoundIndex}
                      className="data-[active=true]:bg-primary/10"
                    >
                      <TableCell className="font-medium text-center">{row.round}</TableCell>
                      <TableCell>{formatTime(row.prep)}</TableCell>
                      <TableCell>{formatTime(row.hold)}</TableCell>
                      <TableCell>{row.recovery > 0 ? formatTime(row.recovery) : 'Finish'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={startSession}>
              <Play className="mr-2 h-5 w-5" /> Start Session
            </Button>
          </div>

        </div>
      )}

      <AlertDialog open={showStopModal} onOpenChange={setShowStopModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end your current training session. You can start a new
              one from the beginning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopSession}>
              Confirm Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
