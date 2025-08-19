'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Overlay } from '@/lib/types';
import { Plus, Trash2, Type, Image } from 'lucide-react';

interface OverlayManagerProps {
  overlays: Overlay[];
  onCreateOverlay: (overlay: Omit<Overlay, '_id'>) => void;
  onDeleteOverlay: (id: string) => void;
}

export default function OverlayManager({ overlays, onCreateOverlay, onDeleteOverlay }: OverlayManagerProps) {
  const [newOverlay, setNewOverlay] = useState({
    type: 'text' as 'text' | 'logo',
    content: '',
    x: 50,
    y: 50,
    width: 200,
    height: 50,
    fontSize: 16,
    color: '#ffffff'
  });

  const handleCreate = () => {
    if (!newOverlay.content.trim()) return;
    onCreateOverlay(newOverlay);
    setNewOverlay({
      ...newOverlay,
      content: '',
      x: newOverlay.x + 20,
      y: newOverlay.y + 20
    });
  };

  return (
    <div className="w-80 bg-background border-l p-4 space-y-4">
      <h3 className="font-semibold text-lg">Overlay Manager</h3>
      
      {/* Create New Overlay */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Overlay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
        
        <div className="flex gap-2">
          <Button
            variant={newOverlay.type === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNewOverlay({ ...newOverlay, type: 'text' })}
          >
            <Type className="h-4 w-4 mr-1" />
            Text
          </Button>
          <Button
            variant={newOverlay.type === 'logo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNewOverlay({ ...newOverlay, type: 'logo' })}
          >
            <Image className="h-4 w-4 mr-1" />
            Logo
          </Button>
        </div>

        <Input
          type="text"
          placeholder={newOverlay.type === 'text' ? 'Enter text' : 'Image URL'}
          value={newOverlay.content}
          onChange={(e) => setNewOverlay({ ...newOverlay, content: e.target.value })}
        />

        {newOverlay.type === 'text' && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Font size"
              value={newOverlay.fontSize}
              onChange={(e) => setNewOverlay({ ...newOverlay, fontSize: parseInt(e.target.value) })}
            />
            <Input
              type="color"
              value={newOverlay.color}
              onChange={(e) => setNewOverlay({ ...newOverlay, color: e.target.value })}
              className="h-10"
            />
          </div>
        )}

          <Button onClick={handleCreate} size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Add Overlay
          </Button>
        </CardContent>
      </Card>

      {/* Existing Overlays */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Overlays ({overlays.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {overlays.map((overlay) => (
            <div key={overlay._id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {overlay.type === 'text' ? overlay.content : 'Logo'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {overlay.x}, {overlay.y}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => overlay._id && onDeleteOverlay(overlay._id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}