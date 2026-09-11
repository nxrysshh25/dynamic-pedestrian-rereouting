import pandas as pd
import os

SIGNALS_FILE = os.path.join(os.path.dirname(__file__), '../../data/raw/traffic_signals/victorian_traffic_signals.csv')

class TrafficSignalsData:
    def __init__(self):
        self.df = None
        
    def load_data(self):
        if not os.path.exists(SIGNALS_FILE):
            print(f"Warning: {SIGNALS_FILE} not found.")
            return
            
        self.df = pd.read_csv(SIGNALS_FILE)
        
    def get_dataframe(self):
        return self.df

signals_data = TrafficSignalsData()
