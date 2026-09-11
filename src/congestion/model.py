import pandas as pd
import os

COUNTS_FILE = os.path.join(os.path.dirname(__file__), '../../data/raw/pedestrian_counts/counts_sample.csv')

class CongestionModel:
    def __init__(self):
        self.df = None
        self.max_count = 1.0
        self.predictive_cache = {}
        
    def load_data(self):
        if not os.path.exists(COUNTS_FILE):
            print(f"Warning: {COUNTS_FILE} not found.")
            return
            
        self.df = pd.read_csv(COUNTS_FILE, sep=';')
        
        # Determine maximum count for normalization
        if not self.df.empty and 'pedestriancount' in self.df.columns:
            self.max_count = self.df['pedestriancount'].max()
            if self.max_count == 0:
                self.max_count = 1.0
                
            # Precompute predictive averages (by hourday and sensor_id)
            # Actually sensor_id is location_id in the dataset
            avg_df = self.df.groupby(['location_id', 'hourday'])['pedestriancount'].mean().reset_index()
            for _, row in avg_df.iterrows():
                loc = int(row['location_id'])
                hr = int(row['hourday'])
                self.predictive_cache[(loc, hr)] = row['pedestriancount'] / self.max_count

    def get_current_congestion(self, location_id: int, date_str: str, hour: int) -> float:
        """
        Returns normalized congestion C_e(t) for a specific date and time.
        """
        if self.df is None or self.df.empty:
            return 0.0
            
        # For performance, this would normally be indexed or cached
        # In a real system, we'd use a database. For this prototype:
        match = self.df[(self.df['location_id'] == location_id) & 
                        (self.df['sensing_date'] == date_str) & 
                        (self.df['hourday'] == hour)]
        
        if not match.empty:
            return match.iloc[0]['pedestriancount'] / self.max_count
        return 0.0
        
    def get_predictive_congestion(self, location_id: int, hour: int) -> float:
        """
        Returns normalized predictive congestion P_e(t) (historical average for that hour).
        """
        return self.predictive_cache.get((location_id, hour), 0.0)

# Singleton instance
congestion_model = CongestionModel()
