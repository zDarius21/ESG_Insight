from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('analyze/', views.analyze_document, name='analyze_document'),
    path('ask-document/', views.ask_document, name='ask_document'),
]
