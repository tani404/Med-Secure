# MedSecure Backend

This repository contains the backend service for MedSecure, a medicine authenticity detection system that classifies uploaded medicine images as Real or Fake using a ResNet50-based deep learning model.

The API is built with FastAPI and serves both prediction endpoints and supporting metadata for the frontend application. It can be run locally for development or deployed to a cloud platform such as Render.

## Overview

MedSecure helps verify whether a medicine package looks authentic by analyzing image quality, packaging characteristics, and model-based visual signals. The backend exposes endpoints for:

- checking service health
- retrieving model metadata
- uploading an image for prediction
- testing model performance
- serving API documentation
- integrating with the frontend and camera-based verification flow

## Main Features

- Real-time medicine image classification
- Support for JPG, JPEG, PNG, BMP, and WEBP uploads
- High-confidence prediction output with probability values
- FastAPI-generated API documentation via Swagger and ReDoc
- CORS support for frontend development
- Model accuracy testing endpoint
- Support for camera-based reference verification pipeline

## Model Performance

The backend reports the following performance metrics for the trained model:

| Metric | Value |
|--------|-------|
| Accuracy | 98.44% |
| Precision | 99.65% |
| Recall | 97.91% |
| F1-Score | 98.77 |

## API Endpoints

### Status and metadata

- `GET /api` - Welcome message and endpoint overview
- `GET /health` - Health check for the service
- `GET /model-info` - Model configuration and metric details

### Prediction

- `POST /predict` - Upload a medicine image for classification
- `POST /predict-from-url` - Predict from a publicly accessible image URL
- `POST /predict-camera` - Run the camera pipeline and combine it with the ResNet50 result

### Testing

- `GET /test` - Evaluate the model against the test dataset

### Documentation

- `GET /docs` - Swagger UI for interactive API testing
- `GET /redoc` - Alternative API docs interface

## Project Structure

```text
ai-mediii/
├── api.py              # FastAPI backend application
├── README.md          # Project documentation
├── requirements.txt   # Python dependencies
├── render.yaml        # Render deployment configuration
├── build.sh           # Build script
├── Procfile           # Process definition for hosting platforms
├── best_model.pth     # Trained model weights
├── archive (1)/       # Dataset files used for validation/testing
└── .gitignore         # Ignored files and directories
```

## Local Development

### 1. Create a virtual environment

```bash
python -m venv venv_torch
```

### 2. Activate it

On Windows:

```bash
venv_torch\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the API

```bash
python api.py
```

The service will be available at:

```text
http://localhost:8000
```

You can also open the interactive documentation at:

```text
http://localhost:8000/docs
```

## Running the Model

The project is designed around a deep learning model that expects RGB images of size 224x224. The prediction pipeline automatically preprocesses uploaded images before inference.

## Usage Examples

### Health check

```bash
curl http://localhost:8000/health
```

### Get model info

```bash
curl http://localhost:8000/model-info
```

### Upload an image for prediction

```bash
curl -X POST "http://localhost:8000/predict" \
  -F "file=@medicine_image.jpg"
```

### Using Python

```python
import requests

with open('medicine.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/predict',
        files={'file': f}
    )

print(response.json())
```

### Run accuracy check

```bash
curl http://localhost:8000/test
```

## Deployment on Render

### Prerequisites

- GitHub account
- Render account
- Repository pushed to GitHub

### Steps

1. Push the repository to GitHub.
2. Log in to Render and create a new web service.
3. Connect the GitHub repository.
4. Set the runtime to Python 3.10.
5. Use the following build command:

```bash
pip install -r requirements.txt
```

6. Use the startup command:

```bash
uvicorn api:app --host 0.0.0.0 --port $PORT
```

7. Deploy the service and use the generated Render URL.

### render.yaml support

If `render.yaml` is present, Render can read the deployment settings automatically when the repository is connected.

## Notes

- The prediction model expects images in RGB format.
- Supported upload formats include JPG, JPEG, PNG, BMP, and WEBP.
- The backend automatically uses CPU if CUDA is unavailable.
- Predictions include both class probabilities and a confidence value.
- The API is designed to work with the frontend and camera-based medicine verification workflow.

## Support

If you run into issues, you can inspect the interactive API docs at `/docs` or check the health endpoint at `/health`.
