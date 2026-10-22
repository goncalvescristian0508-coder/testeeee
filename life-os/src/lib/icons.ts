import {
  Bed, BookOpen, Brain, Briefcase, Check, Coffee, Droplets, Dumbbell, Footprints, Heart, Home, Languages, Leaf, Moon, Music, Pencil, PiggyBank, Salad, Smartphone, SmilePlus, Sparkles, Sun, Sunrise, Utensils, type LucideIcon,
  Flame, Target, Timer, Wind, ShowerHead, BrushCleaning, Shirt, Trash2, Sprout, Laptop, Phone, Bike, Apple, GlassWater, Pill, Stethoscope, Wallet, FolderOpen, Users, Calendar, Scissors,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  check: Check, bed: Bed, book: BookOpen, brain: Brain, briefcase: Briefcase, coffee: Coffee, water: Droplets, dumbbell: Dumbbell, walk: Footprints, heart: Heart, home: Home, languages: Languages, leaf: Leaf, moon: Moon, music: Music, pencil: Pencil, piggy: PiggyBank, salad: Salad, phone: Smartphone, smile: SmilePlus, sparkles: Sparkles, sun: Sun, sunrise: Sunrise, food: Utensils, flame: Flame, target: Target, timer: Timer, wind: Wind, shower: ShowerHead, broom: BrushCleaning, shirt: Shirt, trash: Trash2, sprout: Sprout, laptop: Laptop, call: Phone, bike: Bike, apple: Apple, glass: GlassWater, pill: Pill, doctor: Stethoscope, wallet: Wallet, folder: FolderOpen, users: Users, calendar: Calendar, scissors: Scissors,
};

export const ICON_NAMES = Object.keys(ICONS);

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Check;
}

export const COLORS = ["#22c55e", "#10b981", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb7185", "#f59e0b", "#facc15", "#a3a3a3", "#e5e5e5"];
