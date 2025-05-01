import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { config } from "dotenv";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:3000";
const API_KEY = process.env.API_KEY || "";

// Helper to include X-API-Key in every request
const fetchWithKey = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options.headers || {})
    }
  });
  return res;
};

/**
 * Tool: Get availability
 */
const availabilityTool = new DynamicStructuredTool({
  name: "availability",
  description: "Get open reservation slots for a specific date & party size.",
  schema: z.object({
    date: z.string().describe("YYYY-MM-DD"),
    partySize: z.number().int().positive()
  }),
  async func({ date, partySize }) {
    console.log(`[availabilityTool] Input: date=${date}, partySize=${partySize}`);
    const res = await fetchWithKey(`${BASE_URL}/reservations/availability/check?date=${date}&partySize=${partySize}`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[availabilityTool] Error: ${errorText}`);
      throw new Error("Failed to fetch availability");
    }
    const data = await res.json();
    console.log(`[availabilityTool] Output: ${JSON.stringify(data)}`);
    return { times: data.times };
  }
});

/**
 * Tool: Create reservation
 */
const createReservationTool = new DynamicStructuredTool({
  name: "createReservation",
  description: "Create a reservation and return confirmation details.",
  schema: z.object({
    date: z.string(),
    time: z.string(),
    partySize: z.number().int().positive(),
    name: z.string(),
    phone: z.string(),
    email: z.string().optional()
  }),
  async func(input) {
    console.log(`[createReservationTool] Input: ${JSON.stringify(input)}`);
    const res = await fetchWithKey(`${BASE_URL}/reservations`, {
      method: "POST",
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[createReservationTool] Error: ${errorText}`);
      throw new Error("Failed to create reservation");
    }
    const data = await res.json();
    console.log(`[createReservationTool] Output: ${JSON.stringify(data)}`);
    return data;
  }
});

/**
 * Tool: Lookup reservation
 */
const reservationLookupTool = new DynamicStructuredTool({
  name: "reservationLookup",
  description: "Retrieve reservation details by confirmation ID.",
  schema: z.object({ confirmationId: z.string() }),
  async func({ confirmationId }) {
    console.log(`[reservationLookupTool] Looking up ID: ${confirmationId}`);
    const res = await fetchWithKey(`${BASE_URL}/reservations/${confirmationId}`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[reservationLookupTool] Error: ${errorText}`);
      throw new Error("Reservation not found");
    }
    const data = await res.json();
    console.log(`[reservationLookupTool] Output: ${JSON.stringify(data)}`);
    return data;
  }
});

/**
 * Tool: Update reservation
 */
const updateReservationTool = new DynamicStructuredTool({
  name: "updateReservation",
  description: "Update date, time, or party size for an existing booking.",
  schema: z.object({
    confirmationId: z.string(),
    date: z.string().optional(),
    time: z.string().optional(),
    partySize: z.number().int().positive().optional()
  }),
  async func({ confirmationId, ...updates }) {
    console.log(`[updateReservationTool] Updating ID: ${confirmationId} with: ${JSON.stringify(updates)}`);
    const res = await fetchWithKey(`${BASE_URL}/reservations/${confirmationId}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[updateReservationTool] Error: ${errorText}`);
      throw new Error("Failed to update reservation");
    }
    const data = await res.json();
    console.log(`[updateReservationTool] Output: ${JSON.stringify(data)}`);
    return data;
  }
});

/**
 * Tool: Cancel reservation
 */
const cancelReservationTool = new DynamicStructuredTool({
  name: "cancelReservation",
  description: "Cancel an existing reservation.",
  schema: z.object({ confirmationId: z.string() }),
  async func({ confirmationId }) {
    console.log(`[cancelReservationTool] Canceling ID: ${confirmationId}`);
    const res = await fetchWithKey(`${BASE_URL}/reservations/${confirmationId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[cancelReservationTool] Error: ${errorText}`);
      throw new Error("Failed to cancel reservation");
    }
    const data = await res.json();
    console.log(`[cancelReservationTool] Output: ${JSON.stringify(data)}`);
    return data;
  }
});

/**
 * Tool: Get menu
 */
const menuTool = new DynamicStructuredTool({
  name: "menu",
  description: "Return the current menu grouped by category.",
  schema: z.object({}),
  async func() {
    console.log(`[menuTool] Fetching menu...`);
    const res = await fetchWithKey(`${BASE_URL}/menu`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[menuTool] Error: ${errorText}`);
      throw new Error("Failed to load menu");
    }
    const data = await res.json();
    console.log(`[menuTool] Output: ${JSON.stringify(data)}`);
    return data;
  }
});

export const bistroBotTools = [
  availabilityTool,
  createReservationTool,
  reservationLookupTool,
  updateReservationTool,
  cancelReservationTool,
  menuTool
];
