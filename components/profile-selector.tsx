"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { MarujitaIcon } from "@/components/marujita-icon";

interface Person {
  id: string;
  name: string;
}

interface ProfileSelectorProps {
  people: Person[];
  onSelect: (person: Person) => void;
}

const PROFILE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function ProfileSelector({ people, onSelect }: ProfileSelectorProps) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <MarujitaIcon className="h-20 w-20 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900">Marujita Horas</h1>
          <p className="text-xl text-gray-700">¿Quién eres?</p>
          <p className="text-base text-gray-500">
            Selecciona tu nombre para continuar
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {people.map((person, i) => (
            <Card
              key={person.id}
              className="cursor-pointer hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-2 border-transparent hover:border-blue-400"
              onClick={() => onSelect(person)}
            >
              <CardContent className="pt-6 pb-6 flex flex-col items-center space-y-3">
                <Avatar className="h-20 w-20">
                  <AvatarFallback
                    className={`${PROFILE_COLORS[i % PROFILE_COLORS.length]} text-white text-2xl font-bold`}
                  >
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-lg font-semibold text-gray-900 text-center">
                  {person.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
