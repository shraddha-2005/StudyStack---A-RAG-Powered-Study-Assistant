from django.urls import path
from . import views

urlpatterns = [
    path('', views.landing, name='landing'),       
    path('app/', views.rag_main, name='rag_main'),  

    path('api/sessions/create/', views.create_session, name='create_session'),
    path('api/sessions/', views.get_sessions, name='get_sessions'),
    path('api/sessions/<str:session_id>/messages/', views.get_messages, name='get_messages'),
    path('api/sessions/<str:session_id>/delete/', views.delete_session, name='delete_session'),
    path('api/message/', views.send_message, name='send_message'),
    path('api/upload/', views.upload_file, name='upload_file'),
    path('api/process/<int:file_id>/', views.process_file, name='process_file'),
    path('api/knowledge-base/', views.get_knowledge_base_status, name='knowledge_base_status'),
    path('api/knowledge-base/details/', views.get_knowledge_base_details, name='knowledge_base_details'),  # NEW
    path('api/chunk/<int:chunk_id>/', views.get_chunk_details, name='chunk_details'),  # NEW
    path('api/export/pdf/<str:session_id>/', views.export_chat_pdf, name='export_pdf'),
    path('api/export/word/<str:session_id>/', views.export_chat_word, name='export_word'),
    path('api/files/<int:file_id>/', views.delete_uploaded_file, name='delete_file'),
    path('api/files/status/<int:file_id>/', views.get_processing_status, name='file_status'),
    path('api/generate/mcqs/', views.generate_mcqs, name='generate_mcqs'),
    path('api/generate/concept-map/', views.generate_concept_map, name='concept_map'),
    path('api/cleanup-embeddings/', views.cleanup_embeddings_api, name='cleanup_embeddings'),
    path('api/cleanup-database/', views.cleanup_database, name='cleanup_database'),
    path('api/download-youtube/', views.download_youtube_video, name='download_youtube'),
    path('api/process-file/<int:file_id>/', views.process_file, name='process_file'),
    path('api/files/delete-by-title/', views.delete_file_by_title, name='delete_file_by_title'),
    path('api/cleanup-media/', views.cleanup_media_files, name='cleanup_media'),
]


