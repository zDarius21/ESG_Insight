from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('analyze/', views.analyze_document, name='analyze_document'),
    path('ask-document/', views.ask_document, name='ask_document'),
    path('anonymize-preview/', views.anonymize_preview, name='anonymize_preview'),
    path('anonymize-pdf/', views.anonymize_pdf, name='anonymize_pdf'),
    path('report-pdf/', views.report_pdf, name='report_pdf'),
]
