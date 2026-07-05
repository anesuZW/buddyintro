import { REGIONS, TARGETS, SIM_EMAIL_DOMAIN, type SimRegion } from "@/lib/simulation/constants";
import { mulberry32, pick } from "@/lib/simulation/rng";

const FIRST_NAMES = [
  "Tendai", "Thabo", "Nomsa", "Kuda", "Chipo", "Sibusiso", "Amara", "Kwame", "Zinhle", "Lerato",
  "Tafadzwa", "Boitumelo", "Wanjiku", "Emeka", "Adaeze", "Yusuf", "Priya", "James", "Sarah", "David",
  "Grace", "Michael", "Amina", "Olu", "Chenai", "Farai", "Neo", "Rudo", "Kele", "Zanele",
];

const LAST_NAMES = [
  "Moyo", "Ndlovu", "Okonkwo", "Mbeki", "Kamau", "Okafor", "Dube", "Mutasa", "Chikwanha", "Nkomo",
  "Mthembu", "Adeyemi", "Mwangi", "Sithole", "Gumbo", "Chirwa", "Patel", "Williams", "Johnson", "Mensah",
];

const PROFESSIONS = [
  "Software engineer", "Product manager", "UX designer", "Data analyst", "DevOps engineer",
  "Accountant", "Financial advisor", "Investment analyst", "Bank branch manager",
  "Marketing strategist", "Sales director", "HR business partner", "Operations manager",
  "Civil engineer", "Architect", "Healthcare administrator", "Registered nurse",
  "Teacher", "University lecturer", "Legal counsel", "Management consultant",
  "Agri-business owner", "Logistics coordinator", "Creative director", "Journalist",
  "Startup founder", "Non-profit director", "Real estate agent", "Event planner",
];

const INTERESTS = [
  "fintech", "climate tech", "education", "healthcare", "agriculture", "creative arts",
  "running clubs", "book clubs", "mentorship", "networking events", "church community",
  "startup ecosystems", "remote work", "sustainable business", "youth empowerment",
  "women in tech", "diaspora connections", "professional referrals", "project collaboration",
];

const CITIES: Record<SimRegion, string[]> = {
  Zimbabwe: ["Harare", "Bulawayo", "Mutare", "Gweru"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
  Botswana: ["Gaborone", "Francistown", "Maun"],
  Kenya: ["Nairobi", "Mombasa", "Kisumu"],
  Nigeria: ["Lagos", "Abuja", "Port Harcourt", "Ibadan"],
  "UK diaspora": ["London", "Manchester", "Birmingham", "Bristol"],
};

export type SimPersona = {
  index: number;
  email: string;
  name: string;
  profession: string;
  interests: string[];
  region: SimRegion;
  city: string;
  communityId: string;
  isBridge: boolean;
};

export type SimCommunity = {
  id: string;
  region: SimRegion;
  industry: string;
  memberIndices: number[];
};

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Creative industries",
  "Agribusiness", "Logistics", "Legal & consulting", "Marketing", "Non-profit",
  "Mining & energy", "Real estate", "Media", "Manufacturing", "Hospitality",
  "Fintech", "Telecom", "Retail", "Government relations", "Sports & wellness",
];

export function buildSimulationPlan(userCount: number = TARGETS.users): {
  personas: SimPersona[];
  communities: SimCommunity[];
} {
  const rng = mulberry32(42);
  const bridgeCount = Math.min(100, Math.max(5, Math.floor(userCount * 0.1)));
  const communityCount = 20;
  const communitySize = Math.max(1, Math.floor((userCount - bridgeCount) / communityCount));

  const communities: SimCommunity[] = [];
  for (let c = 0; c < communityCount; c += 1) {
    const region = REGIONS[c % REGIONS.length];
    communities.push({
      id: `community-${c + 1}`,
      region,
      industry: INDUSTRIES[c % INDUSTRIES.length],
      memberIndices: [],
    });
  }

  const personas: SimPersona[] = [];
  let idx = 0;
  for (let c = 0; c < communityCount; c += 1) {
    for (let m = 0; m < communitySize; m += 1) {
      const region = communities[c].region;
      const first = pick(rng, FIRST_NAMES);
      const last = pick(rng, LAST_NAMES);
      const profession = pick(rng, PROFESSIONS);
      personas.push({
        index: idx,
        email: `sim-${idx}${SIM_EMAIL_DOMAIN}`,
        name: `${first} ${last}`,
        profession,
        interests: [pick(rng, INTERESTS), pick(rng, INTERESTS), pick(rng, INTERESTS)],
        region,
        city: pick(rng, CITIES[region]),
        communityId: communities[c].id,
        isBridge: false,
      });
      communities[c].memberIndices.push(idx);
      idx += 1;
    }
  }

  while (idx < userCount) {
    const region = pick(rng, REGIONS);
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    personas.push({
      index: idx,
      email: `sim-${idx}${SIM_EMAIL_DOMAIN}`,
      name: `${first} ${last}`,
      profession: pick(rng, PROFESSIONS),
      interests: [pick(rng, INTERESTS), pick(rng, INTERESTS), pick(rng, INTERESTS)],
      region,
      city: pick(rng, CITIES[region]),
      communityId: "bridge",
      isBridge: true,
    });
    idx += 1;
  }

  return { personas, communities };
}

export function simEmail(index: number): string {
  return `sim-${index}${SIM_EMAIL_DOMAIN}`;
}
