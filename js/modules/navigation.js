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
        this.navigationDelay = 75; // ms
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

    // Focus on specific element by index with conditional scrolling
    focusElement(index, shouldCenter = true) {
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
            
            if (shouldCenter) {
                this.centerElementInView(element);
            } else {
                this.ensureElementVisible(element);
            }
        }
    }

    // Ensure element is visible without aggressive centering
    ensureElementVisible(element) {
        const elementRect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const headerHeight = 200; // Approximate header height
        const footerHeight = 100; // Buffer for footer
        
        // Only scroll if the element is significantly out of view
        if (elementRect.top < headerHeight) {
            // Element is above the visible area
            const targetScrollTop = window.pageYOffset + elementRect.top - headerHeight - 20;
            this.smoothScrollTo(targetScrollTop);
        } else if (elementRect.bottom > viewportHeight - footerHeight) {
            // Element is below the visible area
            const targetScrollTop = window.pageYOffset + elementRect.bottom - viewportHeight + footerHeight + 20;
            this.smoothScrollTo(targetScrollTop);
        }
        // If element is already visible, don't scroll
    }

    centerElementInView(element) {
    if (this.currentScrollAnimation) {
        cancelAnimationFrame(this.currentScrollAnimation);
        this.currentScrollAnimation = null;
    }
    
    // Check if this element is in the global top row
    if (this.isInGlobalTopRow(element)) {
        // For top row elements, always scroll to top of page
        this.smoothScrollTo(0);
    } else {
        // For all other elements, center them
        const elementRect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const elementCenter = elementRect.top + elementRect.height / 2;
        const targetScrollTop = window.pageYOffset + elementCenter - (viewportHeight / 2);
        this.smoothScrollTo(targetScrollTop);
    }
}

// Helper to check if element is in the global top row across all categories
isInGlobalTopRow(element) {
    // Get the absolute top position of this element
    const elementRect = element.getBoundingClientRect();
    const elementTopAbsolute = window.pageYOffset + elementRect.top;
    
    // Get all app cards across all categories
    const allCards = Array.from(document.querySelectorAll('.app-card'));
    if (allCards.length === 0) return false;
    
    // Find the minimum absolute top position across all cards
    const minTopAbsolute = Math.min(...allCards.map(card => {
        const rect = card.getBoundingClientRect();
        return window.pageYOffset + rect.top;
    }));
    
    // Check if our element is in the top row (within threshold)
    const rowThreshold = 30; // pixels
    return Math.abs(elementTopAbsolute - minTopAbsolute) <= rowThreshold;
}

    // Smooth scroll to a target position
    smoothScrollTo(targetScrollTop) {
        if (this.currentScrollAnimation) {
            cancelAnimationFrame(this.currentScrollAnimation);
            this.currentScrollAnimation = null;
        }

        const startScrollTop = window.pageYOffset;
        const distance = targetScrollTop - startScrollTop;
        
        if (Math.abs(distance) < 20) return;
        
        const viewportHeight = window.innerHeight;
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

    // Check if two elements are on the same visual row
    areElementsOnSameRow(element1, element2, tolerance = 20) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        
        // Consider elements on the same row if their vertical centers are within tolerance
        const center1Y = rect1.top + rect1.height / 2;
        const center2Y = rect2.top + rect2.height / 2;
        
        return Math.abs(center1Y - center2Y) <= tolerance;
    }

    // Find the best horizontal neighbor with cross-category navigation
    findHorizontalNeighbor(direction) {
        if (this.focusableElements.length === 0) return { index: -1, sameRow: false };

        const currentElement = this.focusableElements[this.currentFocusIndex];
        const currentCategory = currentElement.closest('.category');
        if (!currentCategory) return { index: -1, sameRow: false };
        
        // Get all categories and current category info
        const allCategories = Array.from(document.querySelectorAll('.category'));
        const currentCategoryIndex = allCategories.indexOf(currentCategory);
        
        // Get all elements in the same category
        const categoryElements = this.focusableElements.filter(el => 
            el.closest('.category') === currentCategory
        );
        
        const currentIndexInCategory = categoryElements.indexOf(currentElement);
        if (currentIndexInCategory === -1) return { index: -1, sameRow: false };
        
        const currentRect = currentElement.getBoundingClientRect();
        const currentCenterY = currentRect.top + currentRect.height / 2;
        const currentCenterX = currentRect.left + currentRect.width / 2;
        
        // First, try to find elements on the same row in the correct direction within current category
        let sameRowCandidates = [];
        
        categoryElements.forEach((element, categoryIndex) => {
            if (element === currentElement) return;
            
            const rect = element.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const centerX = rect.left + rect.width / 2;
            
            const isOnSameRow = Math.abs(centerY - currentCenterY) <= 20;
            const isInCorrectDirection = (direction === 'left' && centerX < currentCenterX) || 
                                       (direction === 'right' && centerX > currentCenterX);
            
            if (isOnSameRow && isInCorrectDirection) {
                sameRowCandidates.push({
                    element,
                    index: this.focusableElements.indexOf(element),
                    distance: Math.abs(centerX - currentCenterX)
                });
            }
        });
        
        // If we have same-row candidates in current category, pick the closest
        if (sameRowCandidates.length > 0) {
            const closest = sameRowCandidates.reduce((best, current) => 
                current.distance < best.distance ? current : best
            );
            return { index: closest.index, sameRow: true };
        }
        
        // No same-row candidates in current category, try adjacent within category first
        let targetIndexInCategory = -1;
        if (direction === 'left' && currentIndexInCategory > 0) {
            targetIndexInCategory = currentIndexInCategory - 1;
        } else if (direction === 'right' && currentIndexInCategory < categoryElements.length - 1) {
            targetIndexInCategory = currentIndexInCategory + 1;
        }
        
        // If we found an adjacent element in the same category, use it
        if (targetIndexInCategory !== -1) {
            const targetElement = categoryElements[targetIndexInCategory];
            const targetIndex = this.focusableElements.indexOf(targetElement);
            const isOnSameRow = this.areElementsOnSameRow(currentElement, targetElement);
            return { index: targetIndex, sameRow: isOnSameRow };
        }
        
        // No adjacent element in current category, try next/previous category
        if (direction === 'right' && currentCategoryIndex < allCategories.length - 1) {
            // Move to first element of next category
            const nextCategory = allCategories[currentCategoryIndex + 1];
            const nextCategoryElements = this.focusableElements.filter(el => 
                el.closest('.category') === nextCategory
            );
            if (nextCategoryElements.length > 0) {
                const targetIndex = this.focusableElements.indexOf(nextCategoryElements[0]);
                return { index: targetIndex, sameRow: false };
            }
        } else if (direction === 'left' && currentCategoryIndex > 0) {
            // Move to last element of previous category
            const prevCategory = allCategories[currentCategoryIndex - 1];
            const prevCategoryElements = this.focusableElements.filter(el => 
                el.closest('.category') === prevCategory
            );
            if (prevCategoryElements.length > 0) {
                const targetIndex = this.focusableElements.indexOf(prevCategoryElements[prevCategoryElements.length - 1]);
                return { index: targetIndex, sameRow: false };
            }
        }
        
        // At the very edges, wrap around completely: DISABLED for now
        // if (direction === 'right') {
        //     // Wrap to very first element
        //     return { index: 0, sameRow: false };
        // } else if (direction === 'left') {
        //     // Wrap to very last element
        //     return { index: this.focusableElements.length - 1, sameRow: false };
        // }
        
        return { index: -1, sameRow: false };
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

        let bestIndex = -1;

        if (direction === 'left' || direction === 'right') {
            // Use improved horizontal navigation with row wrapping
            const result = this.findHorizontalNeighbor(direction);
            
            // If no target found, don't move
            if (result.index === -1) return;
            
            const bestIndex = result.index;
            const sameRow = result.sameRow;
            
            // Focus with appropriate scrolling based on row change
            if (bestIndex !== this.currentFocusIndex) {
                const oldIndex = this.currentFocusIndex;
                this.currentFocusIndex = bestIndex;
                const element = this.focusableElements[this.currentFocusIndex];
                
                // Remove focus from old element
                if (this.focusableElements[oldIndex]) {
                    this.focusableElements[oldIndex].classList.remove('focused');
                    const oldCategory = this.focusableElements[oldIndex].closest('.category');
                    if (oldCategory) {
                        oldCategory.classList.remove('focused-category');
                    }
                }
                
                // Add focus to new element
                element.focus();
                element.classList.add('focused');
                const category = element.closest('.category');
                if (category) {
                    category.classList.add('focused-category');
                }
                
                // Choose scrolling behavior based on whether we're on the same row
                if (sameRow) {
                    // Minimal scrolling for same-row navigation
                    this.ensureElementVisible(element);
                } else {
                    // Center for row wrapping to make the transition clear
                    this.centerElementInView(element);
                }
            }
            return;
        }

        // Vertical navigation (existing logic)
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

        if (bestIndex !== -1 && bestIndex !== this.currentFocusIndex) {
            this.focusElement(bestIndex, true); // Center for vertical navigation
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