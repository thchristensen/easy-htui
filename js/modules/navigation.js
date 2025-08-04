// Navigation module - handles keyboard and gamepad navigation
import { AppState } from '../app.js';

export class NavigationManager {
    constructor(app) {
        this.app = app;
        this.focusableElements = [];
        this.currentFocusIndex = 0;
        this.currentScrollAnimation = null;
        this.gamepadIndex = -1;
        this.lastButtonStates = {};
        this.navigationDelay = 150; // ms
        this.lastNavigationTime = 0;
    }

    // Update list of focusable elements
    updateFocusableElements() {
        this.focusableElements = Array.from(document.querySelectorAll('.app-card'));
        this.currentFocusIndex = 0;
        
        // Focus first element if in navigation mode
        if (AppState.isNavigationMode && this.focusableElements.length > 0) {
            this.focusElement(0);
        }
    }

    // Focus on specific element by index with centered scrolling
    focusElement(index) {
        if (index < 0 || index >= this.focusableElements.length) return;
        
        // Remove focus from current element
        if (this.focusableElements[this.currentFocusIndex]) {
            this.focusableElements[this.currentFocusIndex].classList.remove('focused');
            const currentCategory = this.focusableElements[this.currentFocusIndex].closest('.category');
            if (currentCategory) {
                currentCategory.classList.remove('focused-category');
            }
        }
        
        this.currentFocusIndex = index;
        const element = this.focusableElements[this.currentFocusIndex];
        
        if (element) {
            element.focus();
            element.classList.add('focused');
            const category = element.closest('.category');
            if (category) {
                category.classList.add('focused-category');
            }
            this.centerElementInView(element);
        }
    }

    // Center an element vertically in the viewport
    centerElementInView(element) {
        if (this.currentScrollAnimation) {
            cancelAnimationFrame(this.currentScrollAnimation);
            this.currentScrollAnimation = null;
        }
        
        const elementRect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        const elementCenter = elementRect.top + elementRect.height / 2;
        const targetScrollTop = window.pageYOffset + elementCenter - (viewportHeight / 2);
        
        const startScrollTop = window.pageYOffset;
        const distance = targetScrollTop - startScrollTop;
        
        if (Math.abs(distance) < 20) return;
        
        const duration = 1000 * Math.min(1, Math.abs(distance) / viewportHeight);
        const startTime = performance.now();
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - (1 - progress) * (1 - progress);
            const currentScrollTop = startScrollTop + (distance * easeOut);
            
            window.scrollTo(0, currentScrollTop);
            
            if (progress < 1) {
                this.currentScrollAnimation = requestAnimationFrame(animateScroll);
            } else {
                this.currentScrollAnimation = null;
            }
        };
        
        this.currentScrollAnimation = requestAnimationFrame(animateScroll);
    }

    // Navigate using proper grid position calculation
    navigateGrid(direction) {
        if (this.focusableElements.length === 0) return;

        const now = Date.now();
        if (now - this.lastNavigationTime < this.navigationDelay) return;
        this.lastNavigationTime = now;

        const currentElement = this.focusableElements[this.currentFocusIndex];
        const currentCategory = currentElement.closest('.category');
        if (!currentCategory) return;

        const categories = Array.from(document.querySelectorAll('.category'));
        const currentCategoryIndex = categories.indexOf(currentCategory);

        let allowedCategories = [currentCategory];

        if (direction === 'up' && currentCategoryIndex > 0) {
            allowedCategories.push(categories[currentCategoryIndex - 1]);
        } else if (direction === 'down' && currentCategoryIndex < categories.length - 1) {
            allowedCategories.push(categories[currentCategoryIndex + 1]);
        }

        const currentRect = currentElement.getBoundingClientRect();
        const currentCenter = {
            x: currentRect.left + currentRect.width / 2,
            y: currentRect.top + currentRect.height / 2
        };

        let bestElement = null;
        let bestDistance = Infinity;
        let bestIndex = -1;

        if (direction === 'up' || direction === 'down') {
            // Vertical navigation with category restrictions
            this.focusableElements.forEach((element, index) => {
                if (index === this.currentFocusIndex) return;

                const category = element.closest('.category');
                if (!allowedCategories.includes(category)) return;

                const rect = element.getBoundingClientRect();
                const center = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };

                if (direction === 'up' && center.y >= currentCenter.y - 10) return;
                if (direction === 'down' && center.y <= currentCenter.y + 10) return;

                const horizontalDistance = Math.abs(center.x - currentCenter.x);
                const verticalDistance = Math.abs(center.y - currentCenter.y);
                const distance = horizontalDistance * 2 + verticalDistance;

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestElement = element;
                    bestIndex = index;
                }
            });
        } else if (direction === 'left') {
            bestIndex = this.currentFocusIndex > 0 ? this.currentFocusIndex - 1 : this.currentFocusIndex;
        } else if (direction === 'right') {
            bestIndex = this.currentFocusIndex < this.focusableElements.length - 1 ? this.currentFocusIndex + 1 : this.currentFocusIndex;
        }

        if (bestIndex !== -1 && bestIndex !== this.currentFocusIndex) {
            this.focusElement(bestIndex);
        }
    }

    // Enter navigation mode
    enterNavigationMode() {
        if (!AppState.isNavigationMode) {
            AppState.isNavigationMode = true;
            document.body.classList.add('navigation-mode');
            this.updateFocusableElements();
            if (this.focusableElements.length > 0) {
                this.focusElement(0);
            }
        }
    }

    // Exit navigation mode
    exitNavigationMode() {
        AppState.isNavigationMode = false;
        document.body.classList.remove('navigation-mode');
        
        // Remove focus from current element
        if (this.focusableElements[this.currentFocusIndex]) {
            this.focusableElements[this.currentFocusIndex].classList.remove('focused');
            this.focusableElements[this.currentFocusIndex].blur();
            const currentCategory = this.focusableElements[this.currentFocusIndex].closest('.category');
            if (currentCategory) {
                currentCategory.classList.remove('focused-category');
            }
        }
    }

    // Setup keyboard event listeners
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Admin mode shortcut
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.app.admin.toggleAdminMode();
                return;
            }
            
            // Don't interfere with search input or form inputs
            if (document.activeElement === this.app.searchInput || 
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'SELECT') {
                if (e.key === 'Escape') {
                    this.app.searchInput.value = '';
                    this.app.handleSearch();
                    this.app.searchInput.blur();
                    this.enterNavigationMode();
                } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                    }
                    this.app.searchInput.blur();
                    this.enterNavigationMode();
                }
                return;
            }
            
            // Navigation mode controls
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.enterNavigationMode();
                    this.navigateGrid('up');
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    this.enterNavigationMode();
                    this.navigateGrid('down');
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    this.enterNavigationMode();
                    this.navigateGrid('left');
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    this.enterNavigationMode();
                    this.navigateGrid('right');
                    break;
                    
                case 'Enter':
                case ' ':
                    if (AppState.isNavigationMode && this.focusableElements[this.currentFocusIndex]) {
                        e.preventDefault();
                        this.focusableElements[this.currentFocusIndex].click();
                    }
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    this.exitNavigationMode();
                    this.app.admin.closeModal();
                    break;
                    
                case '/':
                case 'f':
                    e.preventDefault();
                    this.exitNavigationMode();
                    this.app.searchInput.focus();
                    if (e.key === '/') {
                        this.app.searchInput.value = '';
                    }
                    break;
                    
                default:
                    // Start typing to search
                    if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                        this.exitNavigationMode();
                        this.app.searchInput.focus();
                        this.app.searchInput.value = e.key;
                        this.app.handleSearch();
                    }
                    break;
            }
        });
    }

    // Setup gamepad support
    setupGamepadSupport() {
        const pollGamepad = () => {
            const gamepads = navigator.getGamepads();
            
            for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                if (!gamepad) continue;
                
                if (this.gamepadIndex === -1) {
                    this.gamepadIndex = i;
                    console.log('Gamepad connected:', gamepad.id);
                }
                
                if (i === this.gamepadIndex) {
                    this.handleGamepadInput(gamepad);
                }
            }
            
            requestAnimationFrame(pollGamepad);
        };
        
        // Start polling
        pollGamepad();
    }

    // Handle gamepad input
    handleGamepadInput(gamepad) {
        const threshold = 0.5;
        
        // D-pad and left stick
        if (gamepad.axes[0] < -threshold || gamepad.buttons[14]?.pressed) { // Left
            if (!this.lastButtonStates.left) {
                this.enterNavigationMode();
                this.navigateGrid('left');
                this.lastButtonStates.left = true;
            }
        } else {
            this.lastButtonStates.left = false;
        }
        
        if (gamepad.axes[0] > threshold || gamepad.buttons[15]?.pressed) { // Right
            if (!this.lastButtonStates.right) {
                this.enterNavigationMode();
                this.navigateGrid('right');
                this.lastButtonStates.right = true;
            }
        } else {
            this.lastButtonStates.right = false;
        }
        
        if (gamepad.axes[1] < -threshold || gamepad.buttons[12]?.pressed) { // Up
            if (!this.lastButtonStates.up) {
                this.enterNavigationMode();
                this.navigateGrid('up');
                this.lastButtonStates.up = true;
            }
        } else {
            this.lastButtonStates.up = false;
        }
        
        if (gamepad.axes[1] > threshold || gamepad.buttons[13]?.pressed) { // Down
            if (!this.lastButtonStates.down) {
                this.enterNavigationMode();
                this.navigateGrid('down');
                this.lastButtonStates.down = true;
            }
        } else {
            this.lastButtonStates.down = false;
        }
        
        // A button (usually button 0) to activate
        if (gamepad.buttons[0]?.pressed) {
            if (!this.lastButtonStates.a && AppState.isNavigationMode && this.focusableElements[this.currentFocusIndex]) {
                this.focusableElements[this.currentFocusIndex].click();
                this.lastButtonStates.a = true;
            }
        } else {
            this.lastButtonStates.a = false;
        }
        
        // B button (usually button 1) to go back/escape
        if (gamepad.buttons[1]?.pressed) {
            if (!this.lastButtonStates.b) {
                this.exitNavigationMode();
                this.lastButtonStates.b = true;
            }
        } else {
            this.lastButtonStates.b = false;
        }
    }
}