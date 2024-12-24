import streamlit as st
from datetime import datetime
import requests
import json
from geopy.geocoders import Nominatim
import dateutil.parser as dparser
import pandas as pd

def get_latlon(zip_code):
    geolocator = Nominatim(user_agent="heresanapp")
    location = geolocator.geocode("{} USA".format(zip_code))
    lat = location.latitude
    lon = location.longitude
    return location,lat,lon

def get_weather(lat='29.500749',lon='-98.128094'):
    response = requests.get('https://api.weather.gov/points/{},{}'.format(lat,lon))
    if response.status_code == 200:
        text = json.loads(response.text)
        hourly_forecast = text['properties']['forecastHourly']
        seven_day_forecast = text['properties']['forecast']
        hourly = requests.get(hourly_forecast)
        seven_day = requests.get(seven_day_forecast)
    else:
        status_code = response.status_code
        print("Status code error: {}".format(status_code))
    return hourly,seven_day

def get_hourly():    
    hourly_weather = {'time':[],'precip':[],'temp':[]}
    if hourly.status_code == 200:
        hourly_text = json.loads(hourly.text)
        for item in hourly_text['properties']['periods']:
            start_time = dparser.parse(item['startTime']).strftime("%A,  %H:%M")
            #end_time = dparser.parse(item['endTime']).strftime("%H:%M")
            precipitation_chance= item['probabilityOfPrecipitation']['value']
            if precipitation_chance > 0:
                precipitation_chance = str(precipitation_chance)+"%"
            else:
                precipitation_chance = ' '
            temp = str(item['temperature'])+str(item['temperatureUnit'])
            data_points = [start_time,precipitation_chance,temp]
            for index, each_hw in enumerate(hourly_weather.keys()):
                hourly_weather[each_hw].append(data_points[index])
    return hourly_weather

def get_7_day():
    data = {}
    if seven_day.status_code == 200:
        seven_day_text = json.loads(seven_day.text)['properties']['periods']
        for item in seven_day_text:
            day = dparser.parse(item['startTime']).strftime("%a, %d")
            timeframe = item['name']
            if day not in data.keys():
                data[day] = {
                    'high':'',
                    'low':'',
                    'precip':str(' '),
                    'wind':int(),
                }
            temp = str(item['temperature'])+"°"
            wind = item['windSpeed']
            precip = item['probabilityOfPrecipitation']['value']
            
            if 'night' in timeframe or 'Night' in timeframe:
                data[day]['low']=temp
            else:
                data[day]['high']=temp
            if precip != None:
                precip_value = str(precip)+"%"
                data[day]['precip'] = precip_value
            data[day]['wind']=wind 
    return data

now = datetime.now().strftime("%A, %B %d")

st.title("Weather")
st.markdown(now)
zcode_entry = st.text_input("Search by zip code",)

if zcode_entry:
    location,lat,lon = get_latlon(zcode_entry)
    st.markdown("Showing weather for {}".format(location))
    hourly,seven_day = get_weather(lat,lon)
else:
    st.markdown("Showing weather for Seguin, Texas")
    hourly,seven_day = get_weather()
    
seven_forecast = get_7_day()
hourly_forecast = get_hourly()
df_seven_day = pd.DataFrame(seven_forecast).transpose()
df_hourly = pd.DataFrame(hourly_forecast)

st.markdown("7-day: ")
st.dataframe(df_seven_day,use_container_width=True,)

st.markdown("Hourly: ")
st.dataframe(hourly_forecast,use_container_width=True)