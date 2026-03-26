export class IntervalsService {
  private authHeader: string;
  private athleteId: string;

  constructor(apiKey: string, athleteId: string) {
    this.authHeader = `Basic ${btoa(`API_KEY:${apiKey}`)}`;
    this.athleteId = athleteId;
  }

  async fetchActivitiesList(oldest: string): Promise<any[]> {
    const response = await fetch(
      `https://intervals.icu/api/v1/athlete/${this.athleteId}/activities?oldest=${oldest}`,
      {
        headers: {
          'Authorization': this.authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async fetchActivityDetails(activityId: string): Promise<any> {
    const response = await fetch(
      `https://intervals.icu/api/v1/activity/${activityId}?intervals=true`,
      {
        headers: {
          'Authorization': this.authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch details for activity ${activityId}:`, errorText);
      return null;
    }

    return response.json();
  }

  async fetchActivityStreams(activityId: string): Promise<any[]> {
    const response = await fetch(
      `https://intervals.icu/api/v1/activity/${activityId}/streams`,
      {
        headers: {
          'Authorization': this.authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch streams for activity ${activityId}:`, errorText);
      return [];
    }

    return response.json();
  }

  async fetchWellness(oldest: string): Promise<any[]> {
    const response = await fetch(
      `https://intervals.icu/api/v1/athlete/${this.athleteId}/wellness?oldest=${oldest}`,
      {
        headers: {
          'Authorization': this.authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch wellness data:`, errorText);
      return [];
    }

    return response.json();
  }
}
