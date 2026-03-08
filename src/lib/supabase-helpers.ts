import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'tsr_admin' | 'chief_judge' | 'd_judge' | 't_judge' | 'e_judge' | 'stage_manager' | 'scorer';


export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  return (data || []).map(r => r.role as AppRole);
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function calculateFinalScore(
  dScores: number[][],  // array of D judge total scores (each judge has array of asana scores)
  tTotal: number,
  numberOfAsanas: number,
  penalties: number
): { dAverage: number; tAverage: number; tTotal: number; finalScore: number } {
  // Each D judge has a total score (sum of their asana scores with base values applied)
  const dTotals = dScores.map(scores => scores.reduce((a, b) => a + b, 0));

  // Sort and remove highest and lowest
  const sorted = [...dTotals].sort((a, b) => a - b);
  if (sorted.length >= 5) {
    sorted.shift(); // remove lowest
    sorted.pop();   // remove highest
  }

  const dAverage = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  // tTotal is the sum of T Judge's final_scores (already multiplied by Base Value)
  const tAverage = numberOfAsanas > 0 ? tTotal / numberOfAsanas : 0;

  let finalScore = dAverage + tTotal - penalties;
  finalScore = Math.min(finalScore, 70); // Max 70
  finalScore = Math.max(finalScore, 0);

  return {
    dAverage: Math.round(dAverage * 100) / 100,
    tAverage: Math.round(tAverage * 100) / 100,
    tTotal: Math.round(tTotal * 100) / 100,
    finalScore: Math.round(finalScore * 100) / 100,
  };
}
